import { readFile, writeFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { Project, ProjectWorkspace, RepositoryAsset, Requirement, WorkflowDefinition, WorkflowOperationNode, WorkflowTriggerKind } from '../../shared/types/asdp'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { listNode, operationNode, workflowEdge } from '../support/workflow-fixtures'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'

let harness: ApiTestHarness
let projectId: string
let foreignProjectId: string
let statusIds: string[]
let foreignStatusId: string
let repositoryId: string

const configureWorkflow = async (
  owner = projectId,
  kind: WorkflowTriggerKind = 'requirement-status-changed',
  node: WorkflowOperationNode | null = listNode(),
) => {
  const created = await harness.request<WorkflowDefinition>(`/api/projects/${owner}/workflows`, {
    method: 'POST', body: { name: `事件 ${kind}` },
  })
  expect(created.status).toBe(201)
  const configured = await harness.request<WorkflowDefinition>(`/api/workflows/${created.data.id}`, {
    method: 'PATCH',
    body: {
      trigger: { kind, position: { x: 100, y: 0 } },
      nodes: node ? [node] : [],
      edges: node ? [workflowEdge('workflow-trigger', node.id)] : [],
    },
  })
  expect(configured.status).toBe(200)
  expect(configured.data.trigger?.kind).toBe(kind)
  return configured.data
}

const createRequirement = async () => {
  const response = await harness.request<Requirement>(`/api/projects/${projectId}/requirements`, {
    method: 'POST', body: { title: '状态事件需求', statusId: statusIds[0] },
  })
  expect(response.status).toBe(201)
  return response.data
}

const updateStatus = async (id: string, statusId: string) => {
  const response = await harness.request<Requirement>(`/api/requirements/${id}`, {
    method: 'PATCH', body: { statusId },
  })
  expect(response.status).toBe(200)
  expect(response.data.statusId).toBe(statusId)
  return response.data
}

const runs = async (workflowId: string, target = harness) => {
  const response = await target.request<WorkflowRun[]>(`/api/workflows/${workflowId}/runs`)
  expect(response.status).toBe(200)
  return response.data
}

describe('requirement-status-changed workflow events', () => {
  beforeAll(async () => {
    harness = await startApiTestHarness({ gitLabDelayMs: 750 })
    expect((await harness.request('/api/settings/gitlab', {
      method: 'PUT', body: { baseUrl: harness.gitLabBaseUrl, token: 'valid-token' },
    })).status).toBe(200)
    projectId = (await harness.request<Project>('/api/projects', {
      method: 'POST', body: { name: '需求状态事件' },
    })).data.id
    foreignProjectId = (await harness.request<Project>('/api/projects', {
      method: 'POST', body: { name: '隔离项目' },
    })).data.id
    statusIds = (await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`))
      .data.requirementStatuses.map(status => status.id)
    foreignStatusId = (await harness.request<ProjectWorkspace>(`/api/projects/${foreignProjectId}`))
      .data.requirementStatuses[0]!.id
    repositoryId = (await harness.request<RepositoryAsset>(`/api/projects/${projectId}/repositories`, {
      method: 'POST', body: {
        name: 'status-events', provider: 'gitlab', externalId: '101',
        url: `${harness.gitLabBaseUrl}/forgepilot/status-events.git`,
      },
    })).data.id
  })

  afterAll(async () => { await harness?.stop() })

  test('dispatches only ready matching workflows in the owning project and resolves the requirement ID', async () => {
    const branchWorkflow = await configureWorkflow(projectId, 'requirement-status-changed',
      operationNode('branch', repositoryId, '$root.requirementId'))
    const matchingWorkflow = await configureWorkflow()
    const createdWorkflow = await configureWorkflow(projectId, 'requirement-created')
    const manualWorkflow = await configureWorkflow(projectId, 'manual')
    const foreignWorkflow = await configureWorkflow(foreignProjectId)
    const emptyWorkflow = await configureWorkflow(projectId, 'requirement-status-changed', null)
    const requirement = await createRequirement()
    await expect.poll(async () => (await runs(createdWorkflow.id)).map(run => run.status)).toEqual(['succeeded'])
    expect(await runs(branchWorkflow.id)).toEqual([])
    expect(await runs(matchingWorkflow.id)).toEqual([])

    await updateStatus(requirement.id, statusIds[1]!)
    await expect.poll(async () => (await runs(branchWorkflow.id)).map(run => run.status)).toEqual(['succeeded'])
    await expect.poll(async () => (await runs(matchingWorkflow.id)).map(run => run.status)).toEqual(['succeeded'])
    const [run] = await runs(branchWorkflow.id)
    expect(run).toMatchObject({
      triggerEventId: expect.any(String),
      workflow: { trigger: { kind: 'requirement-status-changed' } },
      root: { requirementId: requirement.id, previousStatusId: statusIds[0], statusId: statusIds[1] },
    })
    expect(run!.steps[0]!.resolvedInputs).toMatchObject({ branch: requirement.id })
    expect(run!.steps[0]!.output).toMatchObject({ branch: requirement.id })
    expect(await runs(createdWorkflow.id)).toHaveLength(1)
    for (const workflow of [manualWorkflow, foreignWorkflow, emptyWorkflow]) expect(await runs(workflow.id)).toEqual([])

    const manualStart = await harness.request<{ data: { code: string } }>(`/api/workflows/${matchingWorkflow.id}/runs`, {
      method: 'POST',
    })
    expect(manualStart.status).toBe(409)
    expect(manualStart.data.data.code).toBe('workflow.manual-trigger-required')
    await harness.request(`/api/workflows/${branchWorkflow.id}`, { method: 'DELETE' })
  })

  test('ignores ordinary edits, the same status, rejected updates, and status metadata edits', async () => {
    const workflow = await configureWorkflow()
    const requirement = await createRequirement()
    expect((await harness.request(`/api/requirements/${requirement.id}`, {
      method: 'PATCH', body: { title: '仅更新标题', description: '无需触发' },
    })).status).toBe(200)
    await updateStatus(requirement.id, statusIds[0]!)
    for (const statusId of [foreignStatusId, 'missing-status']) {
      expect((await harness.request(`/api/requirements/${requirement.id}`, {
        method: 'PATCH', body: { statusId },
      })).status).toBe(400)
    }
    expect((await harness.request(`/api/requirements/${requirement.id}`, {
      method: 'PATCH', body: { statusId: statusIds[1], repositoryIds: ['missing-repository'] },
    })).status).toBe(400)
    expect((await harness.request('/api/requirements/missing', {
      method: 'PATCH', body: { statusId: statusIds[1] },
    })).status).toBe(404)
    expect((await harness.request(`/api/requirement-statuses/${statusIds[0]}`, {
      method: 'PATCH', body: { name: '已重命名的草稿' },
    })).status).toBe(200)

    await new Promise(resolve => setTimeout(resolve, 1_100))
    expect(await runs(workflow.id)).toEqual([])
    const current = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
    expect(current.data.requirements.find(item => item.id === requirement.id)?.statusId).toBe(statusIds[0])
  })

  test('preserves each immutable transition when one requirement changes repeatedly', async () => {
    const workflow = await configureWorkflow()
    const requirement = await createRequirement()
    await updateStatus(requirement.id, statusIds[1]!)
    await updateStatus(requirement.id, statusIds[0]!)
    await updateStatus(requirement.id, statusIds[1]!)
    await updateStatus(requirement.id, statusIds[1]!)
    await expect.poll(async () => (await runs(workflow.id)).map(run => run.status))
      .toEqual(['succeeded', 'succeeded', 'succeeded'])
    const history = (await runs(workflow.id)).reverse()
    expect(new Set(history.map(run => run.triggerEventId)).size).toBe(3)
    expect(history.map(run => run.root)).toEqual([
      { requirementId: requirement.id, previousStatusId: statusIds[0], statusId: statusIds[1] },
      { requirementId: requirement.id, previousStatusId: statusIds[1], statusId: statusIds[0] },
      { requirementId: requirement.id, previousStatusId: statusIds[0], statusId: statusIds[1] },
    ])
  })

  test('recovers queued status transitions without replaying an interrupted run', async () => {
    const workflow = await configureWorkflow(projectId, 'requirement-status-changed',
      operationNode('recovery', repositoryId, '$root.requirementId'))
    const requirement = await createRequirement()
    await updateStatus(requirement.id, statusIds[1]!)
    await expect.poll(async () => (await runs(workflow.id))[0]?.status).toBe('running')
    await updateStatus(requirement.id, statusIds[2]!)
    const persisted = await readFile(harness.databasePath)
    await harness.stop()
    const restarted = await startApiTestHarness({ prepareDatabase: databasePath => writeFile(databasePath, persisted) })
    try {
      await expect.poll(async () => (await runs(workflow.id, restarted)).length).toBe(2)
      const history = (await runs(workflow.id, restarted)).reverse()
      expect(new Set(history.map(run => run.triggerEventId)).size).toBe(2)
      expect(history[0]).toMatchObject({ status: 'failed', root: { statusId: statusIds[1] } })
      expect(history[0]!.steps[0]!.error?.code).toBe('workflow.interrupted')
      expect(history[1]!.root).toEqual({
        requirementId: requirement.id, previousStatusId: statusIds[1], statusId: statusIds[2],
      })
    } finally {
      await restarted.stop()
    }
  })
})

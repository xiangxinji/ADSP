import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import type { Project, RepositoryAsset, Requirement, WorkflowDefinition, WorkflowOperationNode } from '../../shared/types/asdp'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'

let harness: ApiTestHarness
let repository: RepositoryAsset
let projectId: string
let foreignProjectId: string
let eventWorkflow: WorkflowDefinition

const configureWorkflow = async (
  owningProjectId: string,
  name: string,
  kind: 'manual' | 'requirement-created',
  node: WorkflowOperationNode,
) => {
  const created = await harness.request<WorkflowDefinition>(`/api/projects/${owningProjectId}/workflows`, {
    method: 'POST', body: { name, note: '' },
  })
  expect(created.status).toBe(201)
  const configured = await harness.request<WorkflowDefinition>(`/api/workflows/${created.data.id}`, {
    method: 'PATCH',
    body: {
      trigger: { kind, position: { x: 100, y: 0 } },
      nodes: [node],
      edges: [{ id: `${node.id}-root`, source: 'workflow-trigger', target: node.id }],
    },
  })
  expect(configured.status).toBe(200)
  return configured.data
}

const createRequirement = async (title: string) => {
  const response = await harness.request<Requirement>(`/api/projects/${projectId}/requirements`, {
    method: 'POST',
    body: {
      title,
      description: `由 ${title} 验证需求创建事件`,
      acceptanceCriteria: '对应事件工作流产生可审计运行记录',
      priority: 'high',
      versionIds: [],
      repositoryIds: [repository.id],
      memberIds: [],
    },
  })
  expect(response.status).toBe(201)
  return response.data
}

const runs = async (workflowId: string, target = harness) => {
  const response = await target.request<WorkflowRun[]>(`/api/workflows/${workflowId}/runs`)
  expect(response.status).toBe(200)
  return response.data
}

describe('requirement-created workflow events', () => {
  beforeAll(async () => {
    harness = await startApiTestHarness({ gitLabDelayMs: 750 })
    expect((await harness.request('/api/settings/gitlab', {
      method: 'PUT', body: { baseUrl: harness.gitLabBaseUrl, token: 'valid-token' },
    })).status).toBe(200)
    const project = await harness.request<Project>('/api/projects', {
      method: 'POST', body: { name: '需求事件项目', description: '' },
    })
    projectId = project.data.id
    const foreignProject = await harness.request<Project>('/api/projects', {
      method: 'POST', body: { name: '其他项目', description: '' },
    })
    foreignProjectId = foreignProject.data.id
    const createdRepository = await harness.request<RepositoryAsset>(`/api/projects/${projectId}/repositories`, {
      method: 'POST',
      body: {
        name: 'requirement-events', provider: 'gitlab', externalId: '101',
        url: `${harness.gitLabBaseUrl}/forgepilot/requirement-events.git`,
      },
    })
    repository = createdRepository.data
  })

  afterAll(async () => { await harness?.stop() })

  test('starts every matching project workflow once for each created requirement', async () => {
    eventWorkflow = await configureWorkflow(projectId, '需求分支', 'requirement-created', {
      id: 'create-requirement-branch',
      assetType: 'repository',
      assetSource: 'input',
      operationId: 'repository.create-branch',
      inputs: { repositoryId: '$root.repositoryIds.0', branch: '$root.title', source: 'main' },
      position: { x: 100, y: 180 },
    })
    const secondEventWorkflow = await configureWorkflow(projectId, '读取需求资产', 'requirement-created', {
      id: 'list-requirement-repositories',
      assetType: 'repository',
      assetSource: 'input',
      operationId: 'repository.list',
      inputs: {},
      position: { x: 100, y: 180 },
    })
    const manualWorkflow = await configureWorkflow(projectId, '手动工作流', 'manual', {
      id: 'manual-list', assetType: 'repository', assetSource: 'input', operationId: 'repository.list',
      inputs: {}, position: { x: 100, y: 180 },
    })
    const foreignWorkflow = await configureWorkflow(foreignProjectId, '其他项目需求事件', 'requirement-created', {
      id: 'foreign-list', assetType: 'repository', assetSource: 'input', operationId: 'repository.list',
      inputs: {}, position: { x: 100, y: 180 },
    })

    const first = await createRequirement('feature/requirement-event-one')
    const second = await createRequirement('feature/requirement-event-two')

    await expect.poll(async () => (await runs(eventWorkflow.id)).length).toBe(2)
    await expect.poll(async () => (await runs(eventWorkflow.id)).map(run => run.status))
      .toEqual(['succeeded', 'succeeded'])
    await expect.poll(async () => (await runs(secondEventWorkflow.id)).map(run => run.status))
      .toEqual(['succeeded', 'succeeded'])

    const eventRuns = await runs(eventWorkflow.id)
    expect(new Set(eventRuns.map(run => (run.root as Requirement).id))).toEqual(new Set([first.id, second.id]))
    expect(eventRuns.every(run => run.workflow.trigger?.kind === 'requirement-created')).toBe(true)
    expect(await runs(manualWorkflow.id)).toEqual([])
    expect(await runs(foreignWorkflow.id)).toEqual([])
    expect(harness.gitLabRequests.filter(request => request.pathname.endsWith('/repository/branches'))
      .map(request => request.query.branch).sort()).toEqual([
      'feature/requirement-event-one',
      'feature/requirement-event-two',
    ])
  })

  test('recovers a processing event without duplicating its run and drains the next queued event', async () => {
    const processing = await createRequirement('feature/queue-recovery-processing')
    await expect.poll(async () => (await runs(eventWorkflow.id))
      .find(run => (run.root as Requirement).id === processing.id)?.status).toBe('running')
    const pending = await createRequirement('feature/queue-recovery-pending')
    const persisted = await readFile(harness.databasePath)
    await harness.stop()

    const restarted = await startApiTestHarness({ prepareDatabase: path => writeFile(path, persisted) })
    try {
      await expect.poll(async () => (await runs(eventWorkflow.id, restarted))
        .some(run => (run.root as Requirement).id === pending.id)).toBe(true)
      const recoveredRuns = await runs(eventWorkflow.id, restarted)
      const processingRuns = recoveredRuns.filter(run => (run.root as Requirement).id === processing.id)
      const pendingRuns = recoveredRuns.filter(run => (run.root as Requirement).id === pending.id)
      expect(processingRuns).toHaveLength(1)
      expect(processingRuns[0]).toMatchObject({ status: 'failed', triggerEventId: expect.any(String) })
      expect(processingRuns[0].steps[0].error?.code).toBe('workflow.interrupted')
      expect(pendingRuns).toHaveLength(1)
      expect(pendingRuns[0].triggerEventId).toEqual(expect.any(String))
      expect(pendingRuns[0].triggerEventId).not.toBe(processingRuns[0].triggerEventId)
    } finally {
      await restarted.stop()
    }
  })
})

import { readFile, writeFile } from 'node:fs/promises'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import type { Project, ProjectWorkspace, Requirement, WorkflowDefinition, WorkflowTrigger } from '../../shared/types/asdp'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { listNode, workflowEdge } from '../support/workflow-fixtures'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'

let harness: ApiTestHarness
let projectId: string
let statusIds: string[]
let requirementId: string
const trigger = (selected?: string[]): WorkflowTrigger => ({
  kind: 'requirement-status-changed', position: { x: 100, y: 0 },
  ...(selected === undefined ? {} : { statusIds: selected }),
})

const configure = async (selected?: string[]) => {
  const created = await harness.request<WorkflowDefinition>(`/api/projects/${projectId}/workflows`, {
    method: 'POST', body: { name: '目标状态筛选' },
  })
  expect(created.status).toBe(201)
  const node = listNode()
  const configured = await harness.request<WorkflowDefinition>(`/api/workflows/${created.data.id}`, {
    method: 'PATCH', body: {
      trigger: trigger(selected), nodes: [node], edges: [workflowEdge('workflow-trigger', node.id)],
    },
  })
  expect(configured.status).toBe(200)
  return configured.data
}

const updateStatus = async (statusId: string) => {
  const updated = await harness.request<Requirement>(`/api/requirements/${requirementId}`, {
    method: 'PATCH', body: { statusId },
  })
  expect(updated.status).toBe(200)
}

const runs = async (workflowId: string) => {
  const history = await harness.request<WorkflowRun[]>(`/api/workflows/${workflowId}/runs`)
  expect(history.status).toBe(200)
  return history.data
}

const getWorkflow = async (workflowId: string) => {
  const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
  return workspace.data.workflows.find(workflow => workflow.id === workflowId)!
}

describe('workflow trigger target status configuration', () => {
  beforeAll(async () => { harness = await startApiTestHarness() })
  afterAll(async () => { await harness?.stop() })
  beforeEach(async () => {
    const project = await harness.request<Project>('/api/projects', { method: 'POST', body: { name: '状态筛选项目' } })
    projectId = project.data.id
    statusIds = (await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)).data.requirementStatuses.map(status => status.id)
    const requirement = await harness.request<Requirement>(`/api/projects/${projectId}/requirements`, {
      method: 'POST', body: { title: '状态筛选需求', statusId: statusIds[0] },
    })
    expect(requirement.status).toBe(201)
    requirementId = requirement.data.id
  })

  test.each(['single', 'multiple', 'any'] as const)('supports %s destination statuses without matching the previous status', async mode => {
    const selected = mode === 'single' ? [statusIds[1]!] : mode === 'multiple' ? [statusIds[1]!, statusIds[2]!] : undefined
    const configured = await configure(selected)
    const allStatuses = await configure()
    for (const next of [statusIds[1]!, statusIds[2]!, statusIds[0]!]) await updateStatus(next)
    await expect.poll(async () => (await runs(allStatuses.id)).map(run => run.status)).toEqual(['succeeded', 'succeeded', 'succeeded'])
    const history = (await runs(configured.id)).reverse()
    expect(history.map(run => run.root.statusId)).toEqual(selected || [statusIds[1], statusIds[2], statusIds[0]])
    expect(history.every(run => run.root.requirementId === requirementId)).toBe(true)
    expect(history.every(run => JSON.stringify(run.workflow.trigger) === JSON.stringify(trigger(selected)))).toBe(true)
    expect((await getWorkflow(configured.id)).trigger).toEqual(trigger(selected))
  })

  test('rejects empty, malformed, unknown, cross-project, and irrelevant filters without replacing the saved filter', async () => {
    const configured = await configure([statusIds[1]!])
    const foreignProject = await harness.request<Project>('/api/projects', { method: 'POST', body: { name: '其他项目' } })
    const foreignStatus = (await harness.request<ProjectWorkspace>(`/api/projects/${foreignProject.data.id}`)).data.requirementStatuses[0]!.id
    for (const invalid of [[], null, statusIds[1], [123], [''], [' '], ['missing'], [foreignStatus]]) {
      const response = await harness.request(`/api/workflows/${configured.id}`, {
        method: 'PATCH', body: { trigger: { ...trigger(), statusIds: invalid } },
      })
      expect(response.status).toBe(400)
      expect((await getWorkflow(configured.id)).trigger?.statusIds).toEqual([statusIds[1]])
    }
    for (const kind of ['manual', 'requirement-created']) {
      expect((await harness.request(`/api/workflows/${configured.id}`, {
        method: 'PATCH', body: { trigger: { ...trigger([statusIds[1]!]), kind } },
      })).status).toBe(400)
    }
    const normalized = await harness.request<WorkflowDefinition>(`/api/workflows/${configured.id}`, {
      method: 'PATCH', body: { trigger: trigger([statusIds[1]!, statusIds[1]!]) },
    })
    expect(normalized.data.trigger?.statusIds).toEqual([statusIds[1]])
  })

  test('preserves filters across metadata edits and clears them only when any-status mode is explicitly saved', async () => {
    const configured = await configure([statusIds[1]!])
    const edited = await harness.request<WorkflowDefinition>(`/api/workflows/${configured.id}`, {
      method: 'PATCH', body: { note: '筛选不应丢失' },
    })
    expect(edited.data.trigger?.statusIds).toEqual([statusIds[1]])
    const cleared = await harness.request<WorkflowDefinition>(`/api/workflows/${configured.id}`, {
      method: 'PATCH', body: { trigger: trigger() },
    })
    expect(cleared.status).toBe(200)
    expect(cleared.data.trigger).not.toHaveProperty('statusIds')
    await updateStatus(statusIds[2]!)
    await expect.poll(async () => (await runs(configured.id)).map(run => run.status)).toEqual(['succeeded'])
  })

  test('retains remaining selected statuses after deletion or renaming without broadening the filter', async () => {
    const configured = await configure([statusIds[1]!, statusIds[2]!])
    const allStatuses = await configure()
    expect((await harness.request(`/api/requirement-statuses/${statusIds[1]}`, { method: 'DELETE' })).status).toBe(204)
    expect((await harness.request(`/api/requirement-statuses/${statusIds[2]}`, {
      method: 'PATCH', body: { name: '新的状态名称' },
    })).status).toBe(200)
    await updateStatus(statusIds[2]!)
    await updateStatus(statusIds[0]!)
    await expect.poll(async () => (await runs(allStatuses.id)).map(run => run.status)).toEqual(['succeeded', 'succeeded'])
    expect((await runs(configured.id)).map(run => run.root.statusId)).toEqual([statusIds[2]])
    expect((await getWorkflow(configured.id)).trigger?.statusIds).toEqual([statusIds[1], statusIds[2]])
  })

  test('persists selected statuses and immutable run snapshots across a server restart', async () => {
    const configured = await configure([statusIds[1]!])
    await updateStatus(statusIds[1]!)
    await expect.poll(async () => (await runs(configured.id)).map(run => run.status)).toEqual(['succeeded'])
    const persisted = await readFile(harness.databasePath)
    await harness.stop()
    harness = await startApiTestHarness({ prepareDatabase: databasePath => writeFile(databasePath, persisted) })
    expect((await getWorkflow(configured.id)).trigger).toEqual(trigger([statusIds[1]!]))
    expect((await runs(configured.id))[0]!.workflow.trigger).toEqual(trigger([statusIds[1]!]))
    const allStatuses = await configure()
    await updateStatus(statusIds[2]!)
    await expect.poll(async () => (await runs(allStatuses.id)).map(run => run.status)).toEqual(['succeeded'])
    expect(await runs(configured.id)).toHaveLength(1)
    await updateStatus(statusIds[1]!)
    await expect.poll(async () => (await runs(configured.id)).map(run => run.status)).toEqual(['succeeded', 'succeeded'])
  })
})

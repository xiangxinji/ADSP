import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import type { RepositoryAsset, WorkflowDefinition, WorkflowOperationNode } from '../../shared/types/asdp'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'

let harness: ApiTestHarness
let repositoryId: string

const createWorkflow = async (nodes: WorkflowOperationNode[] = [], kind = 'manual') => {
  const created = await harness.request<WorkflowDefinition>('/api/projects/project-asdp/workflows', {
    method: 'POST', body: { name: '手动执行测试', note: '' },
  })
  const configured = await harness.request<WorkflowDefinition>(`/api/workflows/${created.data.id}`, {
    method: 'PATCH',
    body: {
      trigger: { kind, position: { x: 100, y: 0 } },
      nodes: [...nodes].reverse(),
      edges: nodes.map((node, index) => ({
        id: `edge-${index}`, source: nodes[index - 1]?.id || 'workflow-trigger', target: node.id,
      })),
    },
  })
  expect(configured.status).toBe(200)
  return configured.data
}

const branchNode = (id: string, branch: string, source = 'main'): WorkflowOperationNode => ({
  id, assetType: 'repository', assetId: repositoryId, operationId: 'repository.create-branch',
  inputs: { repositoryId, branch, source }, position: { x: 100, y: 180 },
})

const runs = async (workflowId: string) => {
  const response = await harness.request<WorkflowRun[]>(`/api/workflows/${workflowId}/runs`)
  expect(response.status).toBe(200)
  return response.data
}

const finishedRun = async (workflowId: string) => {
  let result: WorkflowRun | undefined
  await expect.poll(async () => {
    result = (await runs(workflowId))[0]
    return result?.status
  }).not.toBe('running')
  return result!
}

describe('manual workflow runs', () => {
  beforeAll(async () => {
    harness = await startApiTestHarness({ gitLabDelayMs: 350 })
    const settings = await harness.request('/api/settings/gitlab', {
      method: 'PUT', body: { baseUrl: harness.gitLabBaseUrl, token: 'valid-token' },
    })
    expect(settings.status).toBe(200)
    const repository = await harness.request<RepositoryAsset>('/api/projects/project-asdp/repositories', {
      method: 'POST',
      body: { name: 'workflow-test', provider: 'gitlab', externalId: '101', url: `${harness.gitLabBaseUrl}/forgepilot/workflow-test.git` },
    })
    expect(repository.status).toBe(201)
    repositoryId = repository.data.id
  })

  afterAll(async () => { await harness?.stop() })

  test('executes in edge order and exposes the active node and completed outputs', async () => {
    const workflow = await createWorkflow([
      branchNode('first', 'feature/run-first'), branchNode('second', 'feature/run-second', 'feature/run-first'),
    ])
    const started = await harness.request<WorkflowRun>(`/api/workflows/${workflow.id}/runs`, { method: 'POST' })
    expect(started.status).toBe(202)
    expect(started.data.status).toBe('running')
    expect(started.data.steps.map(step => step.status)).toEqual(['running', 'pending'])
    const duplicate = await harness.request<{ data: { code: string } }>(`/api/workflows/${workflow.id}/runs`, { method: 'POST' })
    expect(duplicate.status).toBe(409)
    expect(duplicate.data.data.code).toBe('workflow.already-running')
    expect((await harness.request(`/api/workflows/${workflow.id}`, { method: 'DELETE' })).status).toBe(409)
    expect((await harness.request('/api/projects/project-asdp', { method: 'DELETE' })).status).toBe(409)
    const edited = await harness.request(`/api/workflows/${workflow.id}`, {
      method: 'PATCH', body: { name: '下一次执行的定义' },
    })
    expect(edited.status).toBe(200)
    await expect.poll(async () => (await runs(workflow.id))[0].steps.map(step => step.status))
      .toEqual(['succeeded', 'running'])
    const result = await finishedRun(workflow.id)
    expect(result.status).toBe('succeeded')
    expect(result.workflow.id).toBe(workflow.id)
    expect(result.workflow.name).toBe('手动执行测试')
    expect(result.steps.map(step => step.nodeId)).toEqual(['first', 'second'])
    expect(result.steps[0].output).toMatchObject({ repositoryId, branch: 'feature/run-first' })
    expect(result.steps[1].output).toMatchObject({ repositoryId, branch: 'feature/run-second' })
    expect(result.steps.every(step => step.startedAt && step.finishedAt)).toBe(true)
    expect(result.finishedAt).toBeTruthy()
  })

  test('preserves error codes, skips downstream nodes, and keeps previous attempts', async () => {
    const workflow = await createWorkflow([
      branchNode('existing', 'main'), branchNode('never', 'feature/never-run'),
    ])
    await harness.request(`/api/workflows/${workflow.id}/runs`, { method: 'POST' })
    const failed = await finishedRun(workflow.id)
    expect(failed.status).toBe('failed')
    expect(failed.steps.map(step => step.status)).toEqual(['failed', 'skipped'])
    expect(failed.steps[0].error?.code).toBe('repository.branch-already-exists')
    expect(failed.steps[0].output).toBeNull()
    expect(failed.steps[1].startedAt).toBeNull()
    expect(harness.gitLabRequests.some(request => request.query.branch === 'feature/never-run')).toBe(false)
    await harness.request(`/api/workflows/${workflow.id}`, { method: 'PATCH', body: { name: '修改后的名称' } })
    await harness.request(`/api/workflows/${workflow.id}/runs`, { method: 'POST' })
    const retry = await finishedRun(workflow.id)
    const history = await runs(workflow.id)
    expect(history).toHaveLength(2)
    expect(retry.id).not.toBe(failed.id)
    expect(history[1]).toEqual(failed)
    expect(history[1].workflow.name).toBe('手动执行测试')
    expect(history[0].workflow.name).toBe('修改后的名称')
  })

  test('rejects missing workflows, empty workflows and non-manual triggers', async () => {
    expect((await harness.request('/api/workflows/missing/runs', { method: 'POST' })).status).toBe(404)
    expect((await harness.request('/api/workflows/missing/runs')).status).toBe(404)
    for (const workflow of [await createWorkflow(), await createWorkflow([branchNode('event', 'feature/event')], 'requirement-created')]) {
      expect((await harness.request(`/api/workflows/${workflow.id}/runs`, { method: 'POST' })).status).toBe(409)
      expect(await runs(workflow.id)).toEqual([])
    }
  })

  test('validates all command inputs before executing any node', async () => {
    const workflow = await createWorkflow([
      branchNode('valid', 'feature/preflight-only'), branchNode('invalid', '../escape'),
    ])
    const response = await harness.request<{ data: { code: string } }>(`/api/workflows/${workflow.id}/runs`, { method: 'POST' })
    expect(response.status).toBe(400)
    expect(response.data.data.code).toBe('repository.invalid-branch')
    expect(await runs(workflow.id)).toEqual([])
    expect(harness.gitLabRequests.some(request => request.query.branch === 'feature/preflight-only')).toBe(false)
  })

  test('revalidates deleted assets and rejects forged run payloads', async () => {
    const workflow = await createWorkflow([branchNode('forged', 'feature/forged')])
    expect((await harness.request(`/api/workflows/${workflow.id}/runs`, {
      method: 'POST', body: { nodes: [], projectId: 'other-project' },
    })).status).toBe(400)
    await harness.request(`/api/repositories/${repositoryId}`, { method: 'DELETE' })
    expect((await harness.request(`/api/workflows/${workflow.id}/runs`, { method: 'POST' })).status).toBe(404)
    expect(await runs(workflow.id)).toEqual([])
  })

  test('recovers an interrupted run without replaying external operations', async () => {
    const repository = await harness.request<RepositoryAsset>('/api/projects/project-asdp/repositories', {
      method: 'POST', body: { name: 'recovery-test', provider: 'gitlab', externalId: '101', url: `${harness.gitLabBaseUrl}/recovery.git` },
    })
    repositoryId = repository.data.id
    const workflow = await createWorkflow([
      branchNode('completed', 'feature/recovery-first'),
      branchNode('interrupted', 'feature/recovery-second'),
      branchNode('skipped', 'feature/recovery-third'),
    ])
    await harness.request(`/api/workflows/${workflow.id}/runs`, { method: 'POST' })
    await expect.poll(async () => (await runs(workflow.id))[0].steps.map(step => step.status))
      .toEqual(['succeeded', 'running', 'pending'])
    const persisted = await readFile(harness.databasePath)
    const restarted = await startApiTestHarness({ prepareDatabase: path => writeFile(path, persisted) })
    try {
      const history = await restarted.request<WorkflowRun[]>(`/api/workflows/${workflow.id}/runs`)
      expect(history.status).toBe(200)
      const recovered = history.data[0]
      expect(recovered.status).toBe('failed')
      expect(recovered.steps.map(step => step.status)).toEqual(['succeeded', 'failed', 'skipped'])
      expect(recovered.steps[0].output).toMatchObject({ branch: 'feature/recovery-first' })
      expect(recovered.steps[1].error?.code).toBe('workflow.interrupted')
      expect(recovered.steps[2].startedAt).toBeNull()
      expect(restarted.gitLabRequests).toEqual([])
    } finally {
      await restarted.stop()
    }
    await finishedRun(workflow.id)
  })
})

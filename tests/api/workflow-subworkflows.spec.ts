import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { Project, RepositoryAsset, WorkflowDefinition, WorkflowNode, WorkflowOperationNode } from '../../shared/types/asdp'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'
import { listNode, operationNode, subworkflowNode, workflowEdge as edge } from '../support/workflow-fixtures'

let harness: ApiTestHarness
let counter = 0
const runs = async (id: string) => (await harness.request<WorkflowRun[]>('/api/workflows/' + id + '/runs')).data
const finish = async (id: string) => {
  await expect.poll(async () => (await runs(id))[0]?.status, { timeout: 10_000 }).not.toBe('running')
  return (await runs(id))[0]!
}
const start = (id: string, root: object = { source: 'main' }) => harness.request<WorkflowRun>('/api/workflows/' + id + '/runs', { method: 'POST', body: { root } })
const create = async (projectId: string, name: string) => {
  const result = await harness.request<WorkflowDefinition>('/api/projects/' + projectId + '/workflows', { method: 'POST', body: { name, note: '' } })
  expect(result.status).toBe(201)
  return result.data
}
const save = (workflow: WorkflowDefinition, nodes: WorkflowNode[], edges = nodes.map((node, index) => edge(nodes[index - 1]?.id || 'workflow-trigger', node.id))) =>
  harness.request<WorkflowDefinition>('/api/workflows/' + workflow.id, { method: 'PATCH', body: {
    trigger: { kind: 'manual', position: { x: 0, y: 0 } }, nodes, edges,
  } })
const setup = async () => {
  const prefix = 'nested-' + ++counter
  const project = await harness.request<Project>('/api/projects', { method: 'POST', body: { name: prefix, description: '' } })
  const repository = await harness.request<RepositoryAsset>('/api/projects/' + project.data.id + '/repositories', {
    method: 'POST', body: { name: prefix, provider: 'gitlab', externalId: '101', url: harness.gitLabBaseUrl + '/test.git' },
  })
  expect(repository.status).toBe(201)
  const child = await create(project.data.id, prefix + '-child')
  const operation = operationNode('branch', repository.data.id, 'feature/' + prefix, '$root.source')
  const savedChild = await save(child, [operation])
  expect(savedChild.status).toBe(200)
  const parent = await create(project.data.id, prefix + '-parent')
  const savedParent = await save(parent, [subworkflowNode(child.id)])
  expect(savedParent.status).toBe(200)
  return { parent: savedParent.data, child: savedChild.data, projectId: project.data.id, repository: repository.data, prefix }
}

beforeAll(async () => {
  harness = await startApiTestHarness({ gitLabDelayMs: 350 })
  expect((await harness.request('/api/settings/gitlab', { method: 'PUT', body: { baseUrl: harness.gitLabBaseUrl, token: 'valid-token' } })).status).toBe(200)
})
afterAll(async () => { await harness?.stop() })

describe('subworkflow API', () => {
  test('persists live internal status, final output and immutable child history inside the parent run', async () => {
    const { parent, child } = await setup()
    const response = await start(parent.id)
    expect(response.status).toBe(202)
    expect(response.data.steps[0]).toMatchObject({ status: 'running', childRun: { workflowId: child.id, status: 'running', steps: [{ nodeId: 'branch', status: 'running' }] } })
    expect((await harness.request('/api/workflows/' + child.id, { method: 'DELETE' })).status).toBe(409)
    expect((await start(child.id)).status).toBe(409)
    expect((await harness.request('/api/workflows/' + child.id, { method: 'PATCH', body: { name: '修改后的子工作流' } })).status).toBe(200)
    const run = await finish(parent.id)
    expect(run.status).toBe('succeeded')
    expect(run.steps[0]?.childRun?.workflow.name).toBe(child.name)
    expect(run.steps[0]?.childRun?.root).toEqual({ source: 'main' })
    expect(run.steps[0]?.output).toEqual(run.steps[0]?.childRun?.output)
    expect(run.output).toEqual(run.steps[0]?.output)
    expect(await runs(child.id)).toEqual([])
    expect((await harness.request('/api/workflows/' + child.id, { method: 'DELETE' })).status).toBe(204)
    expect((await runs(parent.id))[0]).toEqual(run)
    const missing = await start(parent.id)
    expect(missing.status).toBe(400)
    expect(missing.data).toMatchObject({ data: { code: 'workflow.subworkflow-not-found' } })
  })

  test('freezes even not-yet-started child definitions and forwards the last child output to the next node', async () => {
    const { parent, child, repository, prefix } = await setup()
    const childOperation = { ...(child.nodes[0] as WorkflowOperationNode), inputs: { repositoryId: repository.id, branch: 'feature/' + prefix, source: '$root.branch' } }
    expect((await save(child, [childOperation])).status).toBe(200)
    expect((await save(parent, [
      operationNode('before', repository.id, 'feature/' + prefix + '-before'), subworkflowNode(child.id),
      operationNode('after', repository.id, 'feature/' + prefix + '-after', '$prev.branch'),
    ])).status).toBe(200)
    const response = await start(parent.id)
    expect(response.status).toBe(202)
    expect(response.data.steps[1]?.status).toBe('pending')
    expect((await harness.request('/api/workflows/' + child.id, { method: 'DELETE' })).status).toBe(409)
    expect((await save(child, [operationNode('new-node', repository.id, 'feature/' + prefix + '-edited')])).status).toBe(200)
    const run = await finish(parent.id)
    expect(run.status).toBe('succeeded')
    expect(run.steps[1]?.childRun?.workflow.nodes[0]?.id).toBe('branch')
    expect(run.steps[1]?.childRun?.root).toEqual(run.steps[0]?.output)
    expect(run.steps[2]?.resolvedInputs?.source).toBe('feature/' + prefix)
  })

  test('preserves stable internal failure codes and skips the parent continuation', async () => {
    const { parent, child } = await setup()
    expect((await save(parent, [subworkflowNode(child.id), listNode()])).status).toBe(200)
    expect((await start(parent.id, { source: 'missing-source' })).status).toBe(202)
    const run = await finish(parent.id)
    expect(run.status).toBe('failed')
    expect(run.steps[0]).toMatchObject({ status: 'failed', error: { code: 'workflow.subworkflow-failed' }, childRun: {
      status: 'failed', steps: [{ status: 'failed', error: { code: 'repository.source-not-found' } }],
    } })
    expect(run.steps[1]?.status).toBe('skipped')
  })

  test('rejects self calls, indirect cycles, foreign projects and malformed node payloads without saving', async () => {
    const { parent, child } = await setup()
    const foreign = await setup()
    for (const [workflow, target, code] of [
      [parent, parent.id, 'workflow.subworkflow-cycle'], [child, parent.id, 'workflow.subworkflow-cycle'],
      [parent, foreign.child.id, 'workflow.subworkflow-project-mismatch'], [parent, 'missing-workflow', 'workflow.subworkflow-not-found'],
    ] as const) {
      const result = await save(workflow, [subworkflowNode(target)])
      expect(result.status).toBe(400)
      expect(result.data).toMatchObject({ data: { code } })
    }
    expect((await harness.request('/api/workflows/' + parent.id, { method: 'PATCH', body: { nodes: [{ ...subworkflowNode(child.id), workflowId: 123 }] } })).status).toBe(400)
    expect((await start(parent.id)).status).toBe(202)
    expect((await finish(parent.id)).status).toBe('succeeded')
  })

  test('validates every child before any parent side effect and rejects unconfigured children', async () => {
    const { parent, child, repository } = await setup()
    expect((await save(child, [operationNode('invalid', repository.id, 'bad branch name')])).status).toBe(200)
    expect((await save(parent, [operationNode('before', repository.id), subworkflowNode(child.id)])).status).toBe(200)
    const requests = harness.gitLabRequests.length
    expect((await start(parent.id)).status).toBe(400)
    expect(harness.gitLabRequests).toHaveLength(requests)
    expect(await runs(parent.id)).toEqual([])
    expect((await save(child, [])).status).toBe(200)
    const response = await start(parent.id)
    expect(response.status).toBe(400)
    expect(response.data).toMatchObject({ data: { code: 'workflow.subworkflow-not-ready' } })
    expect(harness.gitLabRequests).toHaveLength(requests)
  })

  test('supports nested child workflows returning arrays to their callers', async () => {
    const { parent, child, projectId } = await setup()
    const leaf = await create(projectId, '获取仓库')
    expect((await save(leaf, [listNode()])).status).toBe(200)
    expect((await save(child, [subworkflowNode(leaf.id)])).status).toBe(200)
    expect((await start(parent.id)).status).toBe(202)
    const run = await finish(parent.id)
    expect(run.status).toBe('succeeded')
    expect(run.referencedWorkflowIds).toEqual([child.id, leaf.id])
    expect(Array.isArray(run.output)).toBe(true)
    expect(run.steps[0]?.childRun?.steps[0]?.childRun?.status).toBe('succeeded')
  })
})

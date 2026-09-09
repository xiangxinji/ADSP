import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { Project, ProjectWorkspace, RepositoryAsset, WorkflowControlKind, WorkflowDefinition, WorkflowNode, WorkflowOperationNode } from '../../shared/types/asdp'
import type { WorkflowControlOutput, WorkflowRun } from '../../shared/types/workflow-runs'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'
import { asyncNode, listNode, operationNode, workflowEdge as edge } from '../support/workflow-fixtures'

let harness: ApiTestHarness
let counter = 0
const step = (run: WorkflowRun, id: string) => run.steps.find(step => step.nodeId === id)!
const runs = async (id: string) => (await harness.request<WorkflowRun[]>('/api/workflows/' + id + '/runs')).data
const finish = async (id: string) => {
  await expect.poll(async () => (await runs(id))[0]?.status).not.toBe('running')
  return (await runs(id))[0]!
}
const setup = async (kind: WorkflowControlKind, failure = false, count = 3) => {
  const prefix = kind + '-' + ++counter
  const project = await harness.request<Project>('/api/projects', { method: 'POST', body: { name: prefix, description: '' } })
  expect(project.status).toBe(201)
  const projectId = project.data.id
  for (let index = 0; index < count; index += 1) {
    const response = await harness.request<RepositoryAsset>('/api/projects/' + projectId + '/repositories', {
      method: 'POST', body: { name: failure && index === 1 ? 'main' : 'feature/' + prefix + '-' + index,
        provider: 'gitlab', externalId: String(101 + index), url: harness.gitLabBaseUrl + '/test-' + index + '.git' },
    })
    expect(response.status).toBe(201)
  }
  const workspace = (await harness.request<ProjectWorkspace>('/api/projects/' + projectId)).data
  const assets = workspace.repositories
  const control = { ...asyncNode(), kind }
  const child: WorkflowOperationNode = {
    ...operationNode('child'), assetId: undefined, assetSource: 'input',
    inputs: { repositoryId: '$prev.id', branch: '$prev.name', source: '$root.source' },
  }
  const nodes: WorkflowNode[] = [listNode(), control, child]
  const edges = [edge('workflow-trigger', 'items'), edge('items', 'parallel'), edge('parallel', 'child', 'item')]
  if (count) {
    nodes.push(operationNode('done', assets[0]!.id, 'feature/' + prefix + '-done'), operationNode('handler', assets[0]!.id, 'feature/' + prefix + '-handler'))
    edges.push(edge('parallel', 'done', 'complete'), edge('parallel', 'handler', 'error'))
  }
  const created = await harness.request<WorkflowDefinition>('/api/projects/' + projectId + '/workflows', {
    method: 'POST', body: { name: prefix, note: '' },
  })
  const response = await harness.request<WorkflowDefinition>('/api/workflows/' + created.data.id, {
    method: 'PATCH', body: { trigger: { kind: 'manual', position: { x: 0, y: 0 } },
      nodes: nodes.map(node => node.kind === 'sync' || node.kind === 'async' ? { ...node, branches: undefined } : node).reverse(), edges: [...edges].reverse() },
  })
  expect(response.status).toBe(200)
  return { workflow: response.data, assets, prefix, projectId }
}
const start = (id: string) => harness.request<WorkflowRun>('/api/workflows/' + id + '/runs', {
  method: 'POST', body: { root: { source: 'main' } },
})

beforeAll(async () => {
  harness = await startApiTestHarness({ gitLabDelayMs: 140, gitLabProjectIds: ['101', '102', '103'] })
  expect((await harness.request('/api/settings/gitlab', {
    method: 'PUT', body: { baseUrl: harness.gitLabBaseUrl, token: 'valid-token' },
  })).status).toBe(200)
})
afterAll(async () => { await harness?.stop() })

describe.each(['sync', 'async'] as const)('%s array control API', kind => {
  test('defaults the fixed port and executes each listed asset with immutable run inputs', async () => {
    const { workflow, assets, prefix } = await setup(kind)
    expect(workflow.nodes.find(node => node.id === 'parallel')).toMatchObject({ kind, branches: [{ id: 'item', label: '逐项执行' }] })
    const response = await start(workflow.id)
    expect(response.status).toBe(202)
    expect(step(response.data, 'child').executions).toHaveLength(kind === 'sync' ? 1 : 3)
    expect((await start(workflow.id)).status).toBe(409)
    expect((await harness.request('/api/workflows/' + workflow.id, { method: 'PATCH', body: { name: '后续修改' } })).status).toBe(200)
    const run = await finish(workflow.id)
    expect(run.workflow.name).toBe(prefix)
    expect(run.status).toBe('succeeded')
    expect(step(run, 'child').executions?.map(execution => execution.resolvedInputs?.repositoryId)).toEqual(assets.map(asset => asset.id))
    expect(step(run, 'child').executions?.map(execution => execution.output)).toEqual(assets.map(asset => ({
      repositoryId: asset.id, branch: asset.name, source: 'main',
    })))
    const result = step(run, 'parallel').output as WorkflowControlOutput
    expect(result.branches.map(item => [item.index, item.nodeId, item.status])).toEqual(assets.map((_, index) => [index, 'child', 'succeeded']))
    expect(step(run, 'done').startedAt! >= step(run, 'child').finishedAt!).toBe(true)
    expect(step(run, 'handler').status).toBe('skipped')
    expect(harness.gitLabRequests.filter(request => request.query.branch === 'feature/' + prefix + '-done')).toHaveLength(1)
    expect(run.steps.every(step => step.finishedAt)).toBe(true)
  })

  test('keeps per-item failures, skips later synchronous items and runs the error outlet once', async () => {
    const { workflow, assets, prefix } = await setup(kind, true)
    expect((await start(workflow.id)).status).toBe(202)
    const run = await finish(workflow.id)
    const failedIndex = assets.findIndex(asset => asset.name === 'main')
    expect(run.status).toBe('failed')
    const output = step(run, 'parallel').output as WorkflowControlOutput
    expect(output.selectedPort).toBe('error')
    expect(output.branches.map(item => item.status)).toEqual(assets.map((_, index) => index === failedIndex ? 'failed'
      : kind === 'sync' && index > failedIndex ? 'skipped' : 'succeeded'))
    expect(output.branches[failedIndex]).toMatchObject({ failedNodeId: 'child', error: { code: 'repository.branch-already-exists' } })
    expect(step(run, 'child').status).toBe('failed')
    expect(step(run, 'done').status).toBe('skipped')
    expect(step(run, 'handler').status).toBe('succeeded')
    expect(harness.gitLabRequests.filter(request => request.query.branch === 'feature/' + prefix + '-handler')).toHaveLength(1)
  })

  test('completes empty arrays without child commands or value resolution', async () => {
    const { workflow } = await setup(kind, false, 0)
    const before = harness.gitLabRequests.length
    expect((await start(workflow.id)).status).toBe(202)
    const run = await finish(workflow.id)
    expect(run.status).toBe('succeeded')
    expect(step(run, 'parallel').output).toEqual({ selectedPort: 'complete', branches: [] })
    expect(step(run, 'child').status).toBe('skipped')
    expect(harness.gitLabRequests).toHaveLength(before)
  })

  test('rejects non-array upstream data with a stable runtime code', async () => {
    const { workflow } = await setup(kind, false, 0)
    const nodes = workflow.nodes.filter(node => node.id !== 'items')
    const edges = [edge('workflow-trigger', 'parallel'), edge('parallel', 'child', 'item')]
    expect((await harness.request('/api/workflows/' + workflow.id, { method: 'PATCH', body: { nodes, edges } })).status).toBe(200)
    const before = harness.gitLabRequests.length
    expect((await start(workflow.id)).status).toBe(202)
    const run = await finish(workflow.id)
    expect(step(run, 'parallel').error?.code).toBe('workflow.control-input-not-array')
    expect(step(run, 'child').status).toBe('skipped')
    expect(run.status).toBe('failed')
    expect(harness.gitLabRequests).toHaveLength(before)
  })

  test('rejects manual ports, multiple children, cycles and cross-project assets without altering the graph', async () => {
    const { workflow, projectId } = await setup(kind)
    const control = workflow.nodes.find(node => node.id === 'parallel')!
    for (const branches of [null, [], [{ id: 'custom', label: '自定义' }], [{ id: 'item', label: '逐项执行' }, { id: 'second', label: '第二个' }]]) {
      const nodes = workflow.nodes.map(node => node.id === control.id ? { ...node, branches } : node)
      expect((await harness.request('/api/workflows/' + workflow.id, { method: 'PATCH', body: { nodes } })).status).toBe(400)
    }
    for (const edges of [
      [...workflow.edges.filter(connection => connection.target !== 'done'), edge('parallel', 'done', 'item')],
      workflow.edges.map(connection => connection.sourceHandle === 'item' ? { ...connection, sourceHandle: 'first' } : connection),
      [...workflow.edges, edge('child', 'parallel')],
    ]) expect((await harness.request('/api/workflows/' + workflow.id, { method: 'PATCH', body: { edges } })).status).toBe(400)
    const foreign = await setup(kind)
    const nodes = workflow.nodes.map(node => node.id === 'child' ? operationNode('child', foreign.assets[0]!.id) : node)
    expect((await harness.request('/api/workflows/' + workflow.id, { method: 'PATCH', body: { nodes } })).status).toBe(400)
    const workspace = (await harness.request<ProjectWorkspace>('/api/projects/' + projectId)).data
    expect(workspace.workflows.find(item => item.id === workflow.id)).toEqual(workflow)
  })

  test('validates an inactive outlet before starting any item side effects', async () => {
    const { workflow } = await setup(kind)
    const nodes = workflow.nodes.map(node => node.id === 'handler' ? { ...node, inputs: { ...(node as WorkflowOperationNode).inputs, branch: 'bad branch name' } } : node)
    expect((await harness.request('/api/workflows/' + workflow.id, { method: 'PATCH', body: { nodes } })).status).toBe(200)
    const before = harness.gitLabRequests.length
    expect((await start(workflow.id)).status).toBe(400)
    expect(await runs(workflow.id)).toEqual([])
    expect(harness.gitLabRequests).toHaveLength(before)
  })
})

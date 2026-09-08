import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { ProjectWorkspace, RepositoryAsset, WorkflowDefinition, WorkflowEdge, WorkflowNode } from '../../shared/types/asdp'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'
import { asyncNode, operationNode, workflowEdge as edge } from '../support/workflow-fixtures'

let harness: ApiTestHarness
let repositoryId: string
const createWorkflow = async (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
  const created = await harness.request<WorkflowDefinition>('/api/projects/project-asdp/workflows', {
    method: 'POST', body: { name: '异步执行验收', note: '' },
  })
  const configured = await harness.request<WorkflowDefinition>('/api/workflows/' + created.data.id, {
    method: 'PATCH', body: { trigger: { kind: 'manual', position: { x: 100, y: 0 } }, nodes: [...nodes].reverse(), edges },
  })
  expect(configured.status).toBe(200)
  return configured.data
}
const runs = async (workflowId: string) => (await harness.request<WorkflowRun[]>('/api/workflows/' + workflowId + '/runs')).data
const finished = async (workflowId: string) => {
  await expect.poll(async () => (await runs(workflowId))[0]?.status).not.toBe('running')
  return (await runs(workflowId))[0]!
}
const step = (run: WorkflowRun, nodeId: string) => run.steps.find(step => step.nodeId === nodeId)!
const operation = (id: string, prefix: string, source = 'main') => operationNode(id, repositoryId, 'feature/' + prefix + '-' + id, source)

describe('async workflow API', () => {
  beforeAll(async () => {
    harness = await startApiTestHarness({ gitLabDelayMs: 300 })
    expect((await harness.request('/api/settings/gitlab', {
      method: 'PUT', body: { baseUrl: harness.gitLabBaseUrl, token: 'valid-token' },
    })).status).toBe(200)
    const repository = await harness.request<RepositoryAsset>('/api/projects/project-asdp/repositories', {
      method: 'POST', body: { name: 'async-test', provider: 'gitlab', externalId: '101', url: harness.gitLabBaseUrl + '/test.git' },
    })
    expect(repository.status).toBe(201)
    repositoryId = repository.data.id
  })
  afterAll(async () => { await harness?.stop() })

  test('persists dynamic port IDs and labels, and rejects deletion of a connected port', async () => {
    const workflow = await createWorkflow([asyncNode(), operation('leaf', 'ports')], [edge('workflow-trigger', 'parallel'), edge('parallel', 'leaf', 'first')])
    expect(workflow.nodes[0]).toMatchObject({ kind: 'async', branches: [{ id: 'first' }, { id: 'second' }] })
    expect(workflow.edges[1].sourceHandle).toBe('first')
    const control = workflow.nodes[0]
    if (control.kind !== 'async') throw new Error('Expected async node')
    control.branches[0].label = '重命名端点'
    control.branches.push({ id: 'dynamic-third', label: '新增端点' })
    const renamed = await harness.request<WorkflowDefinition>('/api/workflows/' + workflow.id, { method: 'PATCH', body: { nodes: workflow.nodes } })
    expect(renamed.status).toBe(200)
    expect(renamed.data.edges).toEqual(workflow.edges)
    expect(renamed.data.nodes[0]).toMatchObject({ branches: [{ label: '重命名端点' }, { id: 'second' }, { id: 'dynamic-third' }] })
    control.branches = control.branches.filter(branch => branch.id !== 'first')
    expect((await harness.request('/api/workflows/' + workflow.id, { method: 'PATCH', body: { nodes: workflow.nodes } })).status).toBe(400)
    const saved = await harness.request<ProjectWorkspace>('/api/projects/project-asdp')
    expect(saved.status).toBe(200)
    expect(saved.data.workflows.find(item => item.id === workflow.id)?.edges).toEqual(workflow.edges)
  })

  test('starts branches concurrently and invokes completion only after every branch succeeds', async () => {
    const workflow = await createWorkflow([asyncNode(), ...['first', 'second', 'done', 'handler'].map(id => operation(id, 'success'))], [
      edge('workflow-trigger', 'parallel'), edge('parallel', 'first', 'first'), edge('parallel', 'second', 'second'),
      edge('parallel', 'done', 'complete'), edge('parallel', 'handler', 'error'),
    ])
    const response = await harness.request<WorkflowRun>('/api/workflows/' + workflow.id + '/runs', { method: 'POST' })
    expect(response.status).toBe(202)
    expect(response.data.steps.map(step => step.status)).toEqual(['running', 'running', 'running', 'pending', 'pending'])
    await harness.request('/api/workflows/' + workflow.id, { method: 'PATCH', body: { name: '后续修改不改变运行快照' } })
    const run = await finished(workflow.id)
    expect(run.status).toBe('succeeded')
    expect(run.workflow.name).toBe('异步执行验收')
    expect(step(run, 'parallel').output).toMatchObject({ selectedPort: 'complete', branches: [{ status: 'succeeded' }, { status: 'succeeded' }] })
    expect(step(run, 'done').startedAt! >= step(run, 'second').finishedAt!).toBe(true)
    expect(step(run, 'done').startedAt! >= step(run, 'first').finishedAt!).toBe(true)
    expect(step(run, 'handler').status).toBe('skipped')
    expect(harness.gitLabRequests.filter(request => request.query.branch === 'feature/success-done')).toHaveLength(1)
    expect(harness.gitLabRequests.some(request => request.query.branch === 'feature/success-handler')).toBe(false)
  })

  test('retains active-run protection while a sibling finishes after failure, then executes the error path', async () => {
    const workflow = await createWorkflow([
      asyncNode(), operationNode('failed', repositoryId, 'main'), operation('skipped', 'failure'),
      operation('slow', 'failure'), operation('slow-next', 'failure', 'feature/failure-slow'),
      operation('done', 'failure'), operation('handler', 'failure'),
    ], [
      edge('workflow-trigger', 'parallel'), edge('parallel', 'failed', 'first'), edge('failed', 'skipped'),
      edge('parallel', 'slow', 'second'), edge('slow', 'slow-next'),
      edge('parallel', 'done', 'complete'), edge('parallel', 'handler', 'error'),
    ])
    expect((await harness.request('/api/workflows/' + workflow.id + '/runs', { method: 'POST' })).status).toBe(202)
    await expect.poll(async () => step((await runs(workflow.id))[0]!, 'failed').status).toBe('failed')
    const inProgress = (await runs(workflow.id))[0]!
    expect(inProgress.status).toBe('running')
    expect(step(inProgress, 'handler').status).toBe('pending')
    const duplicate = await harness.request<{ data: { code: string } }>('/api/workflows/' + workflow.id + '/runs', { method: 'POST' })
    expect(duplicate.status).toBe(409)
    expect(duplicate.data.data.code).toBe('workflow.already-running')
    const run = await finished(workflow.id)
    expect(run.status).toBe('failed')
    expect(step(run, 'failed').error?.code).toBe('repository.branch-already-exists')
    expect(step(run, 'skipped').status).toBe('skipped')
    expect(step(run, 'done').status).toBe('skipped')
    expect(step(run, 'handler').status).toBe('succeeded')
    expect(step(run, 'handler').startedAt! >= step(run, 'slow-next').finishedAt!).toBe(true)
    expect(step(run, 'parallel').output).toMatchObject({ selectedPort: 'error', branches: [
      { failedNodeId: 'failed', error: { code: 'repository.branch-already-exists' } }, { status: 'succeeded' },
    ] })
  })

  test('validates every branch and outlet before side effects, including inactive command inputs', async () => {
    const invalid = operation('invalid', 'preflight')
    invalid.inputs.branch = '../escape'
    const workflow = await createWorkflow([asyncNode(), operation('valid', 'preflight'), invalid], [
      edge('workflow-trigger', 'parallel'), edge('parallel', 'valid', 'first'), edge('parallel', 'invalid', 'error'),
    ])
    const rejected = await harness.request<{ data: { code: string } }>('/api/workflows/' + workflow.id + '/runs', { method: 'POST' })
    expect(rejected.status).toBe(400)
    expect(rejected.data.data.code).toBe('repository.invalid-branch')
    expect(await runs(workflow.id)).toEqual([])
    expect(harness.gitLabRequests.some(request => request.query.branch === 'feature/preflight-valid')).toBe(false)
  })

  test('rejects malformed nodes, reserved ports, invalid handles, cycles and cross-project assets', async () => {
    const workflow = await createWorkflow([asyncNode(), operation('leaf', 'validation')], [edge('workflow-trigger', 'parallel'), edge('parallel', 'leaf', 'first')])
    const invalidPayloads = [
      { nodes: [{ ...asyncNode(), kind: 'unknown' }] },
      { nodes: [{ ...asyncNode(), branches: 'not-an-array' }] },
      { nodes: [{ ...asyncNode(), branches: [{ id: 'complete', label: 'Reserved' }] }, operation('leaf', 'validation')] },
      { nodes: [{ ...asyncNode(), branches: [{ id: 'first', label: '' }] }, operation('leaf', 'validation')] },
      { edges: [edge('workflow-trigger', 'parallel'), edge('parallel', 'leaf')] },
      { edges: [...workflow.edges, edge('leaf', 'parallel')] },
      { nodes: [asyncNode(), operation('leaf', 'validation'), ...Array.from({ length: 49 }, (_, index) => operation('extra-' + index, 'limit'))] },
    ]
    for (const body of invalidPayloads) expect((await harness.request('/api/workflows/' + workflow.id, { method: 'PATCH', body })).status).toBe(400)
    const project = await harness.request<{ id: string }>('/api/projects', { method: 'POST', body: { name: 'Other project', description: '' } })
    const foreign = await harness.request<RepositoryAsset>('/api/projects/' + project.data.id + '/repositories', {
      method: 'POST', body: { name: 'foreign', provider: 'gitlab', externalId: '101', url: harness.gitLabBaseUrl + '/foreign.git' },
    })
    expect((await harness.request('/api/workflows/' + workflow.id, {
      method: 'PATCH', body: { nodes: [asyncNode(), operationNode('leaf', foreign.data.id)] },
    })).status).toBe(400)
  })
})

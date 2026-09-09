import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { ProjectWorkspace, RepositoryAsset, WorkflowDefinition, WorkflowEdge, WorkflowNode } from '../../shared/types/asdp'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'
import { asyncNode, listNode, operationNode, workflowEdge as edge } from '../support/workflow-fixtures'

let harness: ApiTestHarness
let repositoryId: string
const ports = [
  { id: 'exists', code: 'repository.branch-already-exists' },
  { id: 'missing', code: 'repository.source-not-found' },
]
const operation = (id: string, branch = 'feature/' + id) => operationNode(id, repositoryId, branch)
const createWorkflow = async (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
  const created = await harness.request<WorkflowDefinition>('/api/projects/project-asdp/workflows', {
    method: 'POST', body: { name: '异常端点验收', note: '' },
  })
  const response = await harness.request<WorkflowDefinition>('/api/workflows/' + created.data.id, {
    method: 'PATCH', body: { trigger: { kind: 'manual', position: { x: 0, y: 0 } }, nodes, edges },
  })
  expect(response.status).toBe(200)
  return response.data
}
const runs = async (workflowId: string) => (await harness.request<WorkflowRun[]>('/api/workflows/' + workflowId + '/runs')).data
const finish = async (workflowId: string) => {
  await expect.poll(async () => (await runs(workflowId))[0]?.status).not.toBe('running')
  return (await runs(workflowId))[0]!
}
const step = (run: WorkflowRun, nodeId: string) => run.steps.find(step => step.nodeId === nodeId)!

describe('workflow operation exception API', () => {
  beforeAll(async () => {
    harness = await startApiTestHarness({ gitLabDelayMs: 100 })
    expect((await harness.request('/api/settings/gitlab', {
      method: 'PUT', body: { baseUrl: harness.gitLabBaseUrl, token: 'valid-token' },
    })).status).toBe(200)
    const response = await harness.request<RepositoryAsset>('/api/projects/project-asdp/repositories', {
      method: 'POST', body: { name: 'exception-test', provider: 'gitlab', externalId: '101', url: harness.gitLabBaseUrl + '/test.git' },
    })
    expect(response.status).toBe(201)
    repositoryId = response.data.id
  })
  afterAll(async () => { await harness?.stop() })

  test('persists ports and stable connections, while failed updates leave the definition unchanged', async () => {
    const root = { ...operation('root'), exceptionPorts: [ports[0]] }
    const workflow = await createWorkflow([root, operation('handler')], [edge('workflow-trigger', 'root'), edge('root', 'handler', 'exists')])
    const get = async () => {
      const response = await harness.request<ProjectWorkspace>('/api/projects/project-asdp')
      expect(response.status).toBe(200)
      return response.data.workflows.find(item => item.id === workflow.id)!
    }
    expect((await get()).nodes[0]).toMatchObject({ exceptionPorts: [ports[0]] })
    root.exceptionPorts = [{ id: 'exists', code: ports[1].code }]
    const updated = await harness.request<WorkflowDefinition>('/api/workflows/' + workflow.id, { method: 'PATCH', body: { nodes: [root, operation('handler')] } })
    expect(updated.status).toBe(200)
    expect(updated.data.edges).toEqual(workflow.edges)
    expect(updated.data.nodes[0]).toMatchObject({ exceptionPorts: root.exceptionPorts })
    const invalidPorts = [null, {}, [{ id: 'exists' }], [{ id: '', code: ports[0].code }],
      [{ id: 'exists', code: 'repository.not-declared' }], [ports[0], ports[0]],
      [ports[0], { ...ports[0], id: 'duplicate-code' }], [],
    ]
    for (const exceptionPorts of invalidPorts) {
      const rejected = await harness.request('/api/workflows/' + workflow.id, {
        method: 'PATCH', body: { nodes: [{ ...root, exceptionPorts }, operation('handler')] },
      })
      expect(rejected.status).toBe(400)
      expect(await get()).toEqual(updated.data)
    }
  })

  test.each(['success', 'failure'])('executes only the selected %s path and persists auditable results', async outcome => {
    const prefix = 'exception-' + outcome
    const root = { ...operation(prefix, outcome === 'failure' ? 'main' : 'feature/' + prefix), exceptionPorts: ports }
    const workflow = await createWorkflow([root, ...['normal', 'handler', 'handler-next', 'other'].map(id => operation(prefix + '-' + id))], [
      edge('workflow-trigger', prefix), edge(prefix, prefix + '-normal'), edge(prefix, prefix + '-handler', 'exists'),
      edge(prefix + '-handler', prefix + '-handler-next'), edge(prefix, prefix + '-other', 'missing'),
    ])
    expect((await harness.request('/api/workflows/' + workflow.id + '/runs', { method: 'POST' })).status).toBe(202)
    const run = await finish(workflow.id)
    expect(run.workflow.nodes[0]).toMatchObject({ exceptionPorts: ports })
    expect(run.steps.every(step => step.finishedAt)).toBe(true)
    expect(step(run, prefix + '-other').status).toBe('skipped')
    expect(step(run, prefix + '-normal').status).toBe(outcome === 'success' ? 'succeeded' : 'skipped')
    expect(step(run, prefix + '-handler').status).toBe(outcome === 'failure' ? 'succeeded' : 'skipped')
    expect(step(run, prefix + '-handler-next').status).toBe(outcome === 'failure' ? 'succeeded' : 'skipped')
    expect(run.status).toBe(outcome === 'failure' ? 'failed' : 'succeeded')
    if (outcome === 'failure') expect(step(run, prefix).error?.code).toBe(ports[0].code)
    const inactive = outcome === 'failure' ? 'normal' : 'handler'
    expect(harness.gitLabRequests.some(request => request.query.branch === 'feature/' + prefix + '-' + inactive)).toBe(false)
  })

  test.each(['root', 'sync', 'async'] as const)('preserves %s data for input-sourced exception handlers', async source => {
    const failed = { ...operation('failed', 'main'), exceptionPorts: [ports[0]] }
    const handler = {
      ...operation('handler'), assetId: undefined, assetSource: 'input' as const,
      inputs: { repositoryId: '$prev.id', branch: '$root.recoveryBranch', source: '$root.source' },
    }
    const nodes: WorkflowNode[] = [failed, handler]
    const edges = [edge('failed', 'handler', 'exists')]
    if (source === 'root') {
      edges.push(edge('workflow-trigger', 'failed'))
      handler.inputs.branch = '$prev.recoveryBranch'
      handler.inputs.source = '$prev.source'
    } else {
      nodes.unshift(listNode(), { ...asyncNode(), kind: source })
      edges.push(edge('workflow-trigger', 'items'), edge('items', 'parallel'), edge('parallel', 'failed', 'item'))
    }
    const workflow = await createWorkflow(nodes, edges)
    const root = { id: repositoryId, recoveryBranch: 'feature/exception-values-' + source, source: 'main' }
    expect((await harness.request('/api/workflows/' + workflow.id + '/runs', { method: 'POST', body: { root } })).status).toBe(202)
    const run = await finish(workflow.id)
    expect(run.root).toEqual(root)
    expect(step(run, 'failed')).toMatchObject({ status: 'failed', output: null, error: { code: ports[0].code } })
    expect(step(run, 'handler')).toMatchObject({
      status: 'succeeded', resolvedInputs: { repositoryId, branch: root.recoveryBranch, source: 'main' },
    })
    expect(harness.gitLabRequests.some(request => request.query.branch === root.recoveryBranch && request.query.ref === 'main')).toBe(true)
    expect(run.status).toBe('failed')
  })

  test('resolves nested exception errors and resumes normal output propagation after the handler', async () => {
    const failed = { ...operation('failed', 'main'), exceptionPorts: [ports[0]] }
    const handler = operation('handler', '$prev.error.code')
    const next = operationNode('next', repositoryId, 'feature/after-exception-handler', '$prev.branch')
    const workflow = await createWorkflow([failed, handler, next], [
      edge('workflow-trigger', 'failed'), edge('failed', 'handler', 'exists'), edge('handler', 'next'),
    ])
    expect((await harness.request('/api/workflows/' + workflow.id + '/runs', {
      method: 'POST', body: { root: { code: 'business-code', message: 'business-message' } },
    })).status).toBe(202)
    const run = await finish(workflow.id)
    expect(step(run, 'handler')).toMatchObject({ status: 'succeeded', resolvedInputs: { branch: ports[0].code } })
    expect(step(run, 'next')).toMatchObject({ status: 'succeeded', resolvedInputs: { source: ports[0].code } })
    expect(run.status).toBe('failed')
  })

  test('leaves legacy failures unchanged when no error matches', async () => {
    const root = { ...operation('unmatched', 'main'), exceptionPorts: [ports[1]] }
    const workflow = await createWorkflow([root, operation('unused')], [edge('workflow-trigger', root.id), edge(root.id, 'unused', 'missing')])
    expect((await harness.request('/api/workflows/' + workflow.id + '/runs', { method: 'POST' })).status).toBe(202)
    const run = await finish(workflow.id)
    expect(run.status).toBe('failed')
    expect(step(run, root.id).error?.code).toBe(ports[0].code)
    expect(step(run, 'unused').status).toBe('skipped')
  })

  test('validates inactive exception commands before creating a run or performing side effects', async () => {
    const root = { ...operation('preflight'), exceptionPorts: [ports[0]] }
    const invalid = operation('invalid', '../escape')
    const workflow = await createWorkflow([root, invalid], [edge('workflow-trigger', root.id), edge(root.id, invalid.id, 'exists')])
    const rejected = await harness.request<{ data: { code: string } }>('/api/workflows/' + workflow.id + '/runs', { method: 'POST' })
    expect(rejected.status).toBe(400)
    expect(rejected.data.data.code).toBe('repository.invalid-branch')
    expect(await runs(workflow.id)).toEqual([])
    expect(harness.gitLabRequests.some(request => request.query.branch === 'feature/preflight')).toBe(false)
  })
})

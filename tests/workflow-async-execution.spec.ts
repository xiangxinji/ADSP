import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { WorkflowRun } from '../shared/types/workflow-runs'
import { executeAssetOperation } from '../server/services/asset-operations'
import { executeWorkflowGraph } from '../server/services/workflow-graph-execution'
import { updateWorkflowRun } from '../server/repositories/workflow-runs'
import { createAssetOperationError } from '../server/utils/asset-operation-error'
import { asyncNode, operationNode, runFixture, workflowEdge as edge } from './support/workflow-fixtures'

vi.mock('../server/services/asset-operations', () => ({ executeAssetOperation: vi.fn() }))
vi.mock('../server/repositories/workflow-runs', () => ({ updateWorkflowRun: vi.fn() }))

const gate = () => {
  let release: () => void = () => {}
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
}
let gates: Map<string, ReturnType<typeof gate>>
let failures: Map<string, unknown>
let snapshots: WorkflowRun[]
const step = (run: WorkflowRun, id: string) => run.steps.find(step => step.nodeId === id)!
const called = () => vi.mocked(executeAssetOperation).mock.calls.map(call => call[1])
const fixture = () => runFixture(
  [asyncNode(), ...['first', 'first-next', 'second', 'done', 'handler', 'handler-next'].map(id => operationNode(id))],
  [edge('workflow-trigger', 'parallel'), edge('parallel', 'first', 'first'), edge('first', 'first-next'),
    edge('parallel', 'second', 'second'), edge('parallel', 'done', 'complete'),
    edge('parallel', 'handler', 'error'), edge('handler', 'handler-next')],
)
const start = (run: WorkflowRun) => executeWorkflowGraph(run, new Map(run.workflow.nodes.flatMap(node => node.kind === 'async' ? [] : [[node.id, node.inputs]])))

describe('async workflow execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gates = new Map()
    failures = new Map()
    snapshots = []
    vi.mocked(updateWorkflowRun).mockImplementation(run => { snapshots.push(structuredClone(run)) })
    vi.mocked(executeAssetOperation).mockImplementation(async (_assetType, assetId) => {
      expect(step(snapshots.at(-1)!, assetId).status).toBe('running')
      if (gates.has(assetId)) await gates.get(assetId)!.promise
      if (failures.has(assetId)) throw failures.get(assetId)
      return { repositoryId: assetId, branch: 'feature/' + assetId, source: 'main' }
    })
  })

  test('starts all branches together, waits for their entire chains and selects completion once', async () => {
    const run = fixture()
    gates.set('first-next', gate())
    gates.set('second', gate())
    const completion = start(run)
    expect(called()).toEqual(['first', 'second'])
    expect(step(run, 'parallel').status).toBe('running')
    await expect.poll(() => step(run, 'first-next').status).toBe('running')
    gates.get('second')!.release()
    await expect.poll(() => step(run, 'second').status).toBe('succeeded')
    expect(step(run, 'done').status).toBe('pending')
    expect(run.status).toBe('running')
    gates.get('first-next')!.release()
    await completion
    expect(run.status).toBe('succeeded')
    expect(step(run, 'parallel').output).toMatchObject({ selectedPort: 'complete', branches: [{ status: 'succeeded' }, { status: 'succeeded' }] })
    expect(called().filter(id => id === 'done')).toHaveLength(1)
    expect(step(run, 'handler').status).toBe('skipped')
    expect(step(run, 'handler-next').startedAt).toBeNull()
    expect(run.steps.every(step => step.finishedAt)).toBe(true)
  })

  test('stops only the failed branch, waits for siblings and preserves original errors after handling', async () => {
    const run = fixture()
    failures.set('first', createAssetOperationError(409, 'repository.branch-already-exists', '分支已存在'))
    gates.set('second', gate())
    const completion = start(run)
    await expect.poll(() => step(run, 'first').status).toBe('failed')
    expect(step(run, 'first-next').status).toBe('skipped')
    expect(step(run, 'second').status).toBe('running')
    expect(step(run, 'handler').status).toBe('pending')
    expect(run.status).toBe('running')
    gates.get('second')!.release()
    await completion
    expect(run.status).toBe('failed')
    expect(step(run, 'parallel').error?.code).toBe('workflow.async-branch-failed')
    expect(step(run, 'parallel').output).toMatchObject({ selectedPort: 'error', branches: [
      { failedNodeId: 'first', error: { code: 'repository.branch-already-exists' } }, { status: 'succeeded' },
    ] })
    expect(step(run, 'done').status).toBe('skipped')
    expect(step(run, 'handler-next').status).toBe('succeeded')
    expect(called().filter(id => id === 'handler')).toHaveLength(1)
    expect(run.steps.every(step => step.finishedAt)).toBe(true)
  })

  test('records multiple failures and handler failure without running completion or retrying', async () => {
    const run = fixture()
    for (const id of ['first', 'second', 'handler']) failures.set(id, createAssetOperationError(409, 'test.' + id, id))
    await start(run)
    expect(step(run, 'parallel').output).toMatchObject({ branches: [{ error: { code: 'test.first' } }, { error: { code: 'test.second' } }] })
    expect(step(run, 'handler').error?.code).toBe('test.handler')
    expect(step(run, 'handler-next').status).toBe('skipped')
    expect(called()).toEqual(['first', 'second', 'handler'])
    expect(run.status).toBe('failed')
  })

  test('sanitizes unexpected command errors and allows an unconnected error outlet', async () => {
    const run = runFixture([asyncNode(), operationNode('leaf')], [edge('workflow-trigger', 'parallel'), edge('parallel', 'leaf', 'first')])
    failures.set('leaf', new Error('private-token=secret'))
    await start(run)
    expect(run.status).toBe('failed')
    expect(step(run, 'leaf').error?.code).toBe('workflow.operation-failed')
    expect(JSON.stringify(run)).not.toContain('private-token')
  })

  test('skips an entire async subtree if its upstream fails', async () => {
    const run = fixture()
    run.workflow.nodes.unshift(operationNode('upstream'))
    run.steps.unshift({ nodeId: 'upstream', status: 'pending', startedAt: null, finishedAt: null, resolvedInputs: null, output: null, error: null })
    run.workflow.edges[0] = edge('workflow-trigger', 'upstream')
    run.workflow.edges.push(edge('upstream', 'parallel'))
    failures.set('upstream', new Error('failed'))
    await start(run)
    expect(called()).toEqual(['upstream'])
    expect(run.steps.slice(1).every(step => step.status === 'skipped')).toBe(true)
  })

  test('propagates nested failures only after the nested error handler finishes', async () => {
    const run = runFixture([asyncNode(), asyncNode('nested'), ...['leaf', 'nested-handler', 'outer-handler'].map(id => operationNode(id))], [
      edge('workflow-trigger', 'parallel'), edge('parallel', 'nested', 'first'), edge('nested', 'leaf', 'first'),
      edge('nested', 'nested-handler', 'error'), edge('parallel', 'outer-handler', 'error'),
    ])
    failures.set('leaf', createAssetOperationError(409, 'test.leaf', 'failed'))
    gates.set('nested-handler', gate())
    const completion = start(run)
    await expect.poll(() => step(run, 'nested-handler').status).toBe('running')
    expect(step(run, 'outer-handler').status).toBe('pending')
    gates.get('nested-handler')!.release()
    await completion
    expect(called()).toEqual(['leaf', 'nested-handler', 'outer-handler'])
    expect(step(run, 'parallel').output).toMatchObject({ branches: [{ failedNodeId: 'leaf', error: { code: 'test.leaf' } }] })
    expect(run.status).toBe('failed')
  })
})

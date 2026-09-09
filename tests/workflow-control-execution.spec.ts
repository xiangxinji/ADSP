import { beforeEach, describe, expect, test, vi } from 'vitest'
import { executeAssetOperation } from '../server/services/asset-operations'
import { executeProjectAssetOperation } from '../server/services/project-asset-operations'
import { executeWorkflowGraph } from '../server/services/workflow-graph-execution'
import { updateWorkflowRun } from '../server/repositories/workflow-runs'
import { createAssetOperationError } from '../server/utils/asset-operation-error'
import type { WorkflowControlKind, WorkflowOperationNode } from '../shared/types/asdp'
import type { WorkflowControlOutput, WorkflowRun } from '../shared/types/workflow-runs'
import { asyncNode, listNode, operationNode, repositoryListItem, runFixture, workflowEdge as edge } from './support/workflow-fixtures'

vi.mock('../server/services/asset-operations', () => ({ executeAssetOperation: vi.fn() }))
vi.mock('../server/services/project-asset-operations', () => ({ executeProjectAssetOperation: vi.fn() }))
vi.mock('../server/services/workflow-asset-resolution', () => ({ resolveWorkflowAssetId: vi.fn((_project, _type, id) => id) }))
vi.mock('../server/repositories/workflow-runs', () => ({ updateWorkflowRun: vi.fn() }))

const gate = () => {
  let release = () => {}
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
}
const step = (run: WorkflowRun, id: string) => run.steps.find(step => step.nodeId === id)!
const output = (run: WorkflowRun) => step(run, 'parallel').output as WorkflowControlOutput
const start = (run: WorkflowRun) => executeWorkflowGraph(run, new Map())
const calls = () => vi.mocked(executeAssetOperation).mock.calls.map(call => [call[1], (call[3] as { branch: string }).branch])
const childNode = (): WorkflowOperationNode => ({
  ...operationNode('child'), assetId: undefined, assetSource: 'input',
  inputs: { repositoryId: '$prev.id', branch: '$prev.name', source: '$root.source' },
})
const fixture = (kind: WorkflowControlKind) => {
  const run = runFixture([listNode(), { ...asyncNode(), kind }, childNode(), operationNode('done'), operationNode('handler')], [
    edge('workflow-trigger', 'items'), edge('items', 'parallel'), edge('parallel', 'child', 'item'),
    edge('parallel', 'done', 'complete'), edge('parallel', 'handler', 'error'),
  ])
  run.root = { source: 'main' }
  return run
}
let gates: Map<string, ReturnType<typeof gate>>
let failures: Map<string, unknown>
let snapshots: WorkflowRun[]

describe.each(['sync', 'async'] as const)('%s array iteration', kind => {
  beforeEach(() => {
    vi.resetAllMocks()
    gates = new Map()
    failures = new Map()
    snapshots = []
    vi.mocked(updateWorkflowRun).mockImplementation(run => { snapshots.push(structuredClone(run)) })
    vi.mocked(executeProjectAssetOperation).mockReturnValue(['first', 'second', 'third'].map(repositoryListItem))
    vi.mocked(executeAssetOperation).mockImplementation(async (_type, assetId, _operation, input) => {
      const values = input as { branch: string, source: string }
      const key = assetId + ':' + values.branch
      if (gates.has(key)) await gates.get(key)!.promise
      if (failures.has(assetId)) throw failures.get(assetId)
      return { repositoryId: assetId, branch: values.branch, source: values.source }
    })
  })

  test('executes the single child once per item with isolated resolved inputs and outputs', async () => {
    const run = fixture(kind)
    await start(run)
    expect(run.status).toBe('succeeded')
    expect(calls()).toEqual([
      ['first', 'feature/first'], ['second', 'feature/second'], ['third', 'feature/third'], ['done', 'feature/done'],
    ])
    expect(step(run, 'child').executions?.map(execution => ({
      path: execution.iterationPath, inputs: execution.resolvedInputs, output: execution.output,
    }))).toEqual(['first', 'second', 'third'].map((id, index) => ({
      path: [{ nodeId: 'parallel', index }],
      inputs: { repositoryId: id, branch: 'feature/' + id, source: 'main' },
      output: { repositoryId: id, branch: 'feature/' + id, source: 'main' },
    })))
    expect(output(run).branches.map(result => [result.index, result.input, result.status])).toEqual(
      ['first', 'second', 'third'].map((id, index) => [index, repositoryListItem(id), 'succeeded']),
    )
    expect(step(run, 'handler').status).toBe('skipped')
    expect(run.steps.every(step => step.finishedAt)).toBe(true)
    expect(run.root).toEqual({ source: 'main' })
  })

  test('waits for the entire child path and starts items sequentially or concurrently', async () => {
    const run = fixture(kind)
    const next = operationNode('next')
    next.inputs.source = '$prev.branch'
    run.workflow.nodes.push(next)
    run.steps.push({ ...step(run, 'done'), nodeId: 'next' })
    run.workflow.edges.push(edge('child', 'next'))
    gates.set('next:feature/next', gate())
    const completion = start(run)
    await expect.poll(() => step(run, 'next').status).toBe('running')
    expect(calls().filter(call => call[0] !== 'next').map(call => call[0])).toEqual(kind === 'sync' ? ['first'] : ['first', 'second', 'third'])
    expect(step(run, 'done').status).toBe('pending')
    gates.get('next:feature/next')!.release()
    await completion
    expect(step(run, 'next').executions?.map(execution => execution.resolvedInputs?.source).sort()).toEqual(['feature/first', 'feature/second', 'feature/third'])
    expect(calls().filter(call => call[0] === 'done')).toHaveLength(1)
  })

  test('retains failure despite later successes and selects the error outlet exactly once', async () => {
    const run = fixture(kind)
    failures.set('second', createAssetOperationError(409, 'repository.branch-already-exists', '已存在'))
    await start(run)
    expect(run.status).toBe('failed')
    expect(output(run).selectedPort).toBe('error')
    expect(output(run).branches.map(result => result.status)).toEqual(['succeeded', 'failed', kind === 'sync' ? 'skipped' : 'succeeded'])
    expect(step(run, 'child').status).toBe('failed')
    expect(step(run, 'child').executions?.[1]?.error?.code).toBe('repository.branch-already-exists')
    expect(step(run, 'parallel').error?.code).toBe('workflow.' + kind + '-branch-failed')
    expect(calls().filter(call => call[0] === 'handler')).toHaveLength(1)
    expect(step(run, 'done').status).toBe('skipped')
  })

  test('does not run children for an empty array and completes once', async () => {
    vi.mocked(executeProjectAssetOperation).mockReturnValue([])
    const run = fixture(kind)
    await start(run)
    expect(output(run)).toEqual({ branches: [], selectedPort: 'complete' })
    expect(calls()).toEqual([['done', 'feature/done']])
    expect(step(run, 'child').status).toBe('skipped')
    expect(run.status).toBe('succeeded')
  })

  test('keeps input ordering when later asynchronous items finish before the first one', async () => {
    const run = fixture(kind)
    gates.set('first:feature/first', gate())
    const completion = start(run)
    await expect.poll(() => step(run, 'child').status).toBe('running')
    if (kind === 'async') {
      await expect.poll(() => step(run, 'child').executions?.[2]?.status).toBe('succeeded')
      expect(step(run, 'child').executions?.[0]?.status).toBe('running')
    } else expect(step(run, 'child').executions).toHaveLength(1)
    expect(step(run, 'done').status).toBe('pending')
    gates.get('first:feature/first')!.release()
    await completion
    expect(output(run).branches.map(result => result.index)).toEqual([0, 1, 2])
    expect(step(run, 'child').executions?.map(execution => execution.resolvedInputs?.repositoryId)).toEqual(['first', 'second', 'third'])
  })

  test('waits for other asynchronous items after a failure without replacing the failed invocation', async () => {
    const run = fixture(kind)
    failures.set('first', createAssetOperationError(409, 'repository.branch-already-exists', '已存在'))
    gates.set('second:feature/second', gate())
    const completion = start(run)
    await expect.poll(() => step(run, 'child').executions?.[0]?.status).toBe('failed')
    if (kind === 'async') {
      expect(run.status).toBe('running')
      expect(step(run, 'child').status).toBe('running')
      expect(step(run, 'handler').status).toBe('pending')
    }
    gates.get('second:feature/second')!.release()
    await completion
    expect(run.status).toBe('failed')
    expect(step(run, 'child').status).toBe('failed')
    expect(step(run, 'child').executions?.[0]?.error?.code).toBe('repository.branch-already-exists')
    expect(calls().filter(call => call[0] === 'handler')).toHaveLength(1)
  })

  test('routes a non-array upstream output to a stable input error without executing the child', async () => {
    const run = fixture(kind)
    run.workflow.edges = run.workflow.edges.filter(connection => connection.source !== 'items' && connection.target !== 'items')
    run.workflow.edges.push(edge('workflow-trigger', 'parallel'))
    run.workflow.nodes = run.workflow.nodes.filter(node => node.id !== 'items')
    run.steps = run.steps.filter(step => step.nodeId !== 'items')
    await start(run)
    expect(step(run, 'parallel').error?.code).toBe('workflow.control-input-not-array')
    expect(output(run)).toEqual({ branches: [], selectedPort: 'error' })
    expect(calls()).toEqual([['handler', 'feature/handler']])
    expect(step(run, 'child').status).toBe('skipped')
    expect(run.status).toBe('failed')
  })

  test('keeps skipped exception paths local to each item and waits for its handler', async () => {
    const run = fixture(kind)
    const child = run.workflow.nodes.find(node => node.id === 'child') as WorkflowOperationNode
    child.exceptionPorts = [{ id: 'exists', code: 'repository.branch-already-exists' }]
    run.workflow.nodes.push(operationNode('recovery'))
    run.steps.push({ ...step(run, 'done'), nodeId: 'recovery' })
    run.workflow.edges.push(edge('child', 'recovery', 'exists'))
    failures.set('second', createAssetOperationError(409, 'repository.branch-already-exists', '已存在'))
    gates.set('recovery:feature/recovery', gate())
    const completion = start(run)
    await expect.poll(() => step(run, 'recovery').status).toBe('running')
    expect(step(run, 'handler').status).toBe('pending')
    gates.get('recovery:feature/recovery')!.release()
    await completion
    expect(step(run, 'recovery').executions?.map(execution => execution.status)).toEqual(['skipped', 'succeeded', 'skipped'])
    expect(run.status).toBe('failed')
  })

  test('supports nested control scopes without overwriting repeated child records', async () => {
    const run = fixture(kind)
    const nested = { ...asyncNode('nested'), kind: kind === 'sync' ? 'async' as const : 'sync' as const }
    run.workflow.nodes.push(listNode('nested-items'), nested)
    for (const nodeId of ['nested-items', 'nested']) run.steps.push({ ...step(run, 'done'), nodeId })
    run.workflow.edges = run.workflow.edges.filter(connection => connection.target !== 'child')
    run.workflow.edges.push(edge('parallel', 'nested-items', 'item'), edge('nested-items', 'nested'), edge('nested', 'child', 'item'))
    await start(run)
    expect(run.status).toBe('succeeded')
    expect(step(run, 'child').executions).toHaveLength(9)
    expect(new Set(step(run, 'child').executions?.map(execution => JSON.stringify(execution.iterationPath))).size).toBe(9)
    expect(step(run, 'nested').executions).toHaveLength(3)
    expect(calls().filter(call => call[0] === 'done')).toHaveLength(1)
    expect(snapshots.some(snapshot => step(snapshot, 'child').status === 'running')).toBe(true)
  })
})

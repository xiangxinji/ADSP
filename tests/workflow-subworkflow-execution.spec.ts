import { beforeEach, describe, expect, test, vi } from 'vitest'
import { executeAssetOperation } from '../server/services/asset-operations'
import { executeProjectAssetOperation } from '../server/services/project-asset-operations'
import { executeWorkflowGraph } from '../server/services/workflow-graph-execution'
import { updateWorkflowRun, listActiveWorkflowRuns } from '../server/repositories/workflow-runs'
import { assertWorkflowIdle, recoverInterruptedWorkflowRuns } from '../server/services/workflow-runs'
import { createAssetOperationError } from '../server/utils/asset-operation-error'
import type { WorkflowRun } from '../shared/types/workflow-runs'
import { asyncNode, listNode, operationNode, repositoryListItem, runFixture, subworkflowNode, workflowFixture, workflowEdge as edge } from './support/workflow-fixtures'

vi.mock('../server/services/asset-operations', () => ({ executeAssetOperation: vi.fn() }))
vi.mock('../server/services/project-asset-operations', () => ({ executeProjectAssetOperation: vi.fn() }))
vi.mock('../server/services/workflow-asset-resolution', () => ({ resolveWorkflowAssetId: vi.fn((_project, _type, id) => id) }))
vi.mock('../server/repositories/workflow-runs', () => ({ updateWorkflowRun: vi.fn(), listActiveWorkflowRuns: vi.fn() }))

const step = (run: WorkflowRun, id: string) => run.steps.find(step => step.nodeId === id)!
const childWorkflow = () => ({
  ...workflowFixture([{
    ...operationNode('branch'), assetId: undefined, assetSource: 'input' as const,
    inputs: { repositoryId: '$root.id', branch: '$root.name', source: 'main' },
  }], [edge('workflow-trigger', 'branch')]), id: 'child-workflow', name: '子工作流',
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(executeProjectAssetOperation).mockReturnValue(['first', 'second'].map(repositoryListItem))
  vi.mocked(executeAssetOperation).mockImplementation(async (_type, repositoryId, _operation, input) => ({ repositoryId, ...(input as { branch: string, source: string }) }))
})

describe('subworkflow execution', () => {
  test('waits for child completion, persists live internal status and forwards final output', async () => {
    const run = runFixture([subworkflowNode(), { ...operationNode('next'), inputs: { repositoryId: 'next', branch: '$prev.branch', source: 'main' } }], [edge('workflow-trigger', 'call'), edge('call', 'next')])
    run.root = repositoryListItem('first')
    let release = () => {}
    const gate = new Promise<void>(resolve => { release = resolve })
    vi.mocked(executeAssetOperation).mockImplementationOnce(async () => {
      await gate
      return { repositoryId: 'first', branch: 'feature/first', source: 'main' }
    })
    const snapshots: WorkflowRun[] = []
    vi.mocked(updateWorkflowRun).mockImplementation(current => { snapshots.push(structuredClone(current)) })
    const child = childWorkflow()
    const completion = executeWorkflowGraph(run, new Map(), { workflows: new Map([[child.id, child]]) })
    expect(step(run, 'call').status).toBe('running')
    expect(step(run, 'call').childRun?.steps[0]?.status).toBe('running')
    expect(step(run, 'next').status).toBe('pending')
    expect(snapshots.some(snapshot => step(snapshot, 'call').childRun?.steps[0]?.status === 'running')).toBe(true)
    expect(vi.mocked(updateWorkflowRun).mock.calls.every(([saved]) => saved.id === run.id)).toBe(true)
    release()
    await completion
    expect(run.status).toBe('succeeded')
    expect(step(run, 'call').childRun?.root).toEqual(run.root)
    expect(step(run, 'next').resolvedInputs?.branch).toBe('feature/first')
    expect(run.output).toEqual({ repositoryId: 'next', branch: 'feature/first', source: 'main' })
    expect(step(run, 'call').childRun?.workflow).not.toBe(child)
  })

  test('keeps concurrent invocations of the same workflow isolated', async () => {
    const run = runFixture([listNode(), asyncNode(), subworkflowNode()], [edge('workflow-trigger', 'items'), edge('items', 'parallel'), edge('parallel', 'call', 'item')])
    const child = childWorkflow()
    await executeWorkflowGraph(run, new Map(), { workflows: new Map([[child.id, child]]) })
    const calls = step(run, 'call').executions!
    expect(run.status).toBe('succeeded')
    expect(calls).toHaveLength(2)
    expect(new Set(calls.map(call => call.childRun?.id)).size).toBe(2)
    expect(calls.map(call => call.childRun?.root)).toEqual(['first', 'second'].map(repositoryListItem))
    expect(calls.map(call => call.childRun?.steps[0]?.resolvedInputs?.repositoryId)).toEqual(['first', 'second'])
    expect(step(run, 'call').childRun).toBeUndefined()
  })

  test('retains original child errors and skips the parent continuation', async () => {
    const run = runFixture([subworkflowNode(), listNode()], [edge('workflow-trigger', 'call'), edge('call', 'items')])
    run.root = repositoryListItem('first')
    vi.mocked(executeAssetOperation).mockRejectedValue(createAssetOperationError(404, 'repository.source-not-found', 'Source missing'))
    const child = childWorkflow()
    await executeWorkflowGraph(run, new Map(), { workflows: new Map([[child.id, child]]) })
    expect(run.status).toBe('failed')
    expect(step(run, 'call').error?.code).toBe('workflow.subworkflow-failed')
    expect(step(run, 'call').childRun?.steps[0]?.error?.code).toBe('repository.source-not-found')
    expect(step(run, 'items').status).toBe('skipped')
    expect(executeProjectAssetOperation).not.toHaveBeenCalled()
  })

  test('allows internally handled exceptions to complete successfully', async () => {
    const run = runFixture([subworkflowNode(), listNode()], [edge('workflow-trigger', 'call'), edge('call', 'items')])
    run.root = repositoryListItem('first')
    const child = childWorkflow()
    Object.assign(child.nodes[0]!, { exceptionPorts: [{ id: 'exists', code: 'repository.branch-already-exists' }] })
    vi.mocked(executeAssetOperation).mockRejectedValue(createAssetOperationError(409, 'repository.branch-already-exists', 'Already exists'))
    await executeWorkflowGraph(run, new Map(), { workflows: new Map([[child.id, child]]) })
    expect(run.status).toBe('succeeded')
    expect(step(run, 'call').status).toBe('succeeded')
    expect(step(run, 'call').childRun?.steps[0]?.status).toBe('handled')
    expect(step(run, 'items').status).toBe('succeeded')
  })

  test('supports multiple nesting levels and array output into a parent control node', async () => {
    const leaf = { ...workflowFixture([listNode()], [edge('workflow-trigger', 'items')]), id: 'leaf' }
    const child = { ...workflowFixture([subworkflowNode('leaf')], [edge('workflow-trigger', 'call')]), id: 'child-workflow' }
    const run = runFixture([subworkflowNode(), asyncNode(), listNode()], [edge('workflow-trigger', 'call'), edge('call', 'parallel'), edge('parallel', 'items', 'item')])
    await executeWorkflowGraph(run, new Map(), { workflows: new Map([[child.id, child], [leaf.id, leaf]]) })
    expect(run.status).toBe('succeeded')
    expect(step(run, 'call').output).toEqual(['first', 'second'].map(repositoryListItem))
    expect(step(run, 'items').executions).toHaveLength(2)
    expect(step(run, 'call').childRun?.steps[0]?.childRun?.status).toBe('succeeded')
  })

  test('recovers nested unfinished records while preserving completed children and reserves referenced workflows', () => {
    const run = runFixture([subworkflowNode()], [edge('workflow-trigger', 'call')])
    const child = runFixture([operationNode('running'), operationNode('pending')], [])
    child.steps[0]!.status = 'running'
    Object.assign(step(run, 'call'), { status: 'running', childRun: child })
    run.referencedWorkflowIds = ['child-workflow']
    vi.mocked(listActiveWorkflowRuns).mockReturnValue([run])
    expect(() => assertWorkflowIdle('child-workflow')).toThrow()
    recoverInterruptedWorkflowRuns()
    expect(child.status).toBe('failed')
    expect(child.steps.map(step => [step.status, step.error?.code])).toEqual([
      ['failed', 'workflow.interrupted'], ['skipped', 'workflow.interrupted'],
    ])
    expect(step(run, 'call').error?.code).toBe('workflow.interrupted')
  })
})

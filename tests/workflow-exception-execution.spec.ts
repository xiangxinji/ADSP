import { beforeEach, describe, expect, test, vi } from 'vitest'
import { executeAssetOperation } from '../server/services/asset-operations'
import { executeProjectAssetOperation } from '../server/services/project-asset-operations'
import { executeWorkflowGraph } from '../server/services/workflow-graph-execution'
import { createAssetOperationError } from '../server/utils/asset-operation-error'
import type { WorkflowRun } from '../shared/types/workflow-runs'
import { asyncNode, listNode, repositoryListItem, operationNode, runFixture, workflowEdge as edge } from './support/workflow-fixtures'

vi.mock('../server/services/asset-operations', () => ({ executeAssetOperation: vi.fn() }))
vi.mock('../server/services/project-asset-operations', () => ({ executeProjectAssetOperation: vi.fn() }))
vi.mock('../server/repositories/workflow-runs', () => ({ updateWorkflowRun: vi.fn() }))

const exceptionPorts = [
  { id: 'exists', code: 'repository.branch-already-exists' },
  { id: 'missing', code: 'repository.source-not-found' },
]
const operation = (id: string) => ({ ...operationNode(id), exceptionPorts: structuredClone(exceptionPorts) })
const fixture = () => runFixture([operation('root'), ...['normal', 'normal-next', 'handler', 'handler-next', 'other'].map(id => operationNode(id))], [
  edge('workflow-trigger', 'root'), edge('root', 'normal'), edge('normal', 'normal-next'),
  edge('root', 'handler', 'exists'), edge('handler', 'handler-next'), edge('root', 'other', 'missing'),
])
const step = (run: WorkflowRun, id: string) => run.steps.find(step => step.nodeId === id)!
const start = (run: WorkflowRun) => executeWorkflowGraph(run, new Map(run.workflow.nodes.flatMap(node => 'inputs' in node ? [[node.id, node.inputs]] : [])))
const called = () => vi.mocked(executeAssetOperation).mock.calls.map(call => call[1])
let failures: Map<string, unknown>

describe('workflow operation exception execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    failures = new Map()
    vi.mocked(executeProjectAssetOperation).mockReturnValue([repositoryListItem('first')])
    vi.mocked(executeAssetOperation).mockImplementation(async (_assetType, assetId) => {
      if (failures.has(assetId)) throw failures.get(assetId)
      return { repositoryId: assetId, branch: 'feature/' + assetId, source: 'main' }
    })
  })

  test('success runs only the normal path and skips entire exception subtrees', async () => {
    const run = fixture()
    await start(run)
    expect(called()).toEqual(['root', 'normal', 'normal-next'])
    expect(run.status).toBe('succeeded')
    for (const id of ['handler', 'handler-next', 'other']) expect(step(run, id)).toMatchObject({ status: 'skipped', startedAt: null })
    expect(run.steps.every(step => step.finishedAt)).toBe(true)
  })

  test.each(exceptionPorts)('matches only $code, not the translated message', async ({ id, code }) => {
    const run = fixture()
    failures.set('root', createAssetOperationError(409, code, '任意错误描述'))
    await start(run)
    expect(called()).toEqual(id === 'exists' ? ['root', 'handler', 'handler-next'] : ['root', 'other'])
    expect(step(run, 'root')).toMatchObject({ status: 'failed', error: { code, message: '任意错误描述' } })
    expect(run.status).toBe('failed')
    expect(run.steps.every(step => step.finishedAt)).toBe(true)
  })

  test.each([
    createAssetOperationError(502, 'repository.gitlab-unavailable', 'repository.branch-already-exists'),
    new Error('secret-token'),
  ])('does not route unmatched or unexpected errors', async error => {
    const run = fixture()
    failures.set('root', error)
    await start(run)
    expect(called()).toEqual(['root'])
    expect(run.steps.slice(1).every(step => step.status === 'skipped')).toBe(true)
    expect(JSON.stringify(run)).not.toContain('secret-token')
    expect(run.status).toBe('failed')
  })

  test('allows unconnected exception ports without falling through to the normal path', async () => {
    const run = runFixture([operation('root'), operationNode('normal')], [edge('workflow-trigger', 'root'), edge('root', 'normal')])
    failures.set('root', createAssetOperationError(409, exceptionPorts[0].code, 'failed'))
    await start(run)
    expect(called()).toEqual(['root'])
    expect(step(run, 'normal').status).toBe('skipped')
  })

  test('supports nested exception handlers and retains both original failures without retries', async () => {
    const run = runFixture([operation('root'), operation('handler'), operationNode('fallback')], [
      edge('workflow-trigger', 'root'), edge('root', 'handler', 'exists'), edge('handler', 'fallback', 'missing'),
    ])
    failures.set('root', createAssetOperationError(409, exceptionPorts[0].code, 'root failed'))
    failures.set('handler', createAssetOperationError(404, exceptionPorts[1].code, 'handler failed'))
    await start(run)
    expect(called()).toEqual(['root', 'handler', 'fallback'])
    expect(step(run, 'root').error?.code).toBe(exceptionPorts[0].code)
    expect(step(run, 'handler').error?.code).toBe(exceptionPorts[1].code)
    expect(step(run, 'fallback').status).toBe('succeeded')
    expect(run.status).toBe('failed')
  })

  test('records a failed handler and skips its remaining normal children without retrying', async () => {
    const run = fixture()
    failures.set('root', createAssetOperationError(409, exceptionPorts[0].code, 'root failed'))
    failures.set('handler', createAssetOperationError(404, exceptionPorts[1].code, 'handler failed'))
    await start(run)
    expect(called()).toEqual(['root', 'handler'])
    expect(step(run, 'handler-next').status).toBe('skipped')
    expect(step(run, 'root').error?.code).toBe(exceptionPorts[0].code)
    expect(step(run, 'handler').error?.code).toBe(exceptionPorts[1].code)
    expect(run.steps.every(step => step.finishedAt)).toBe(true)
  })

  test('supports an async subtree as the matching operation exception path', async () => {
    const run = runFixture([operation('root'), listNode(), asyncNode(), ...['first', 'done'].map(id => operationNode(id))], [
      edge('workflow-trigger', 'root'), edge('root', 'items', 'exists'), edge('items', 'parallel'),
      edge('parallel', 'first', 'item'), edge('parallel', 'done', 'complete'),
    ])
    failures.set('root', createAssetOperationError(409, exceptionPorts[0].code, 'failed'))
    await start(run)
    expect(called()).toEqual(['root', 'first', 'done'])
    expect(step(run, 'parallel').output).toMatchObject({ selectedPort: 'complete' })
    expect(run.status).toBe('failed')
  })

  test('waits for a child operation exception handler before selecting the async error outlet', async () => {
    const run = runFixture([listNode(), asyncNode(), operation('root'), operationNode('handler'), operationNode('outer')], [
      edge('workflow-trigger', 'items'), edge('items', 'parallel'), edge('parallel', 'root', 'item'), edge('root', 'handler', 'exists'), edge('parallel', 'outer', 'error'),
    ])
    failures.set('root', createAssetOperationError(409, exceptionPorts[0].code, 'failed'))
    await start(run)
    expect(called()).toEqual(['root', 'handler', 'outer'])
    expect(step(run, 'parallel').output).toMatchObject({ selectedPort: 'error', branches: [{ failedNodeId: 'root', error: { code: exceptionPorts[0].code } }] })
  })
})

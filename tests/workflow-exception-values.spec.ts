import { beforeEach, describe, expect, test, vi } from 'vitest'
import { executeAssetOperation } from '../server/services/asset-operations'
import { executeProjectAssetOperation } from '../server/services/project-asset-operations'
import { executeWorkflowGraph } from '../server/services/workflow-graph-execution'
import { createAssetOperationError } from '../server/utils/asset-operation-error'
import type { WorkflowOperationNode } from '../shared/types/asdp'
import type { WorkflowRun } from '../shared/types/workflow-runs'
import { asyncNode, listNode, operationNode, repositoryListItem, runFixture, workflowEdge as edge } from './support/workflow-fixtures'

vi.mock('../server/services/asset-operations', () => ({ executeAssetOperation: vi.fn() }))
vi.mock('../server/services/project-asset-operations', () => ({ executeProjectAssetOperation: vi.fn() }))
vi.mock('../server/services/workflow-asset-resolution', () => ({ resolveWorkflowAssetId: vi.fn((_projectId, _assetType, input) => input) }))
vi.mock('../server/repositories/workflow-runs', () => ({ updateWorkflowRun: vi.fn() }))

const ports = [{ id: 'exists', code: 'repository.branch-already-exists' }]
const operation = (id: string): WorkflowOperationNode => ({ ...operationNode(id), exceptionPorts: ports })
const start = (run: WorkflowRun) => executeWorkflowGraph(run, new Map(run.workflow.nodes.flatMap(node => 'inputs' in node ? [[node.id, node.inputs]] : [])))
const step = (run: WorkflowRun, id: string) => run.steps.find(step => step.nodeId === id)!

describe('workflow exception parameter propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(executeAssetOperation).mockImplementation(async (_assetType, assetId, _operationId, input) => {
      const value = input as { branch: string, source: string }
      if (value.branch === 'existing') throw createAssetOperationError(409, ports[0].code, 'branch-exists')
      return { repositoryId: assetId, branch: value.branch, source: value.source }
    })
  })

  test('forwards original data without input overrides or collisions with business fields', async () => {
    const failed = operation('failed')
    failed.inputs.branch = 'existing'
    const handler = operationNode('handler')
    handler.inputs.branch = '$prev.branch'
    handler.inputs.source = '$prev.code'
    const run = runFixture([failed, handler], [edge('workflow-trigger', 'failed'), edge('failed', 'handler', 'exists')])
    run.root = { branch: 'feature/original', code: 'business-code', message: 'business-message', nested: { enabled: false } }
    const root = structuredClone(run.root)

    await start(run)

    expect(step(run, 'failed')).toMatchObject({ status: 'handled', output: null, error: { code: ports[0].code } })
    expect(step(run, 'handler')).toMatchObject({
      status: 'succeeded', resolvedInputs: { branch: 'feature/original', source: 'business-code' },
    })
    expect(run.root).toEqual(root)
    expect(run.status).toBe('succeeded')
  })

  test.each(['sync', 'async'] as const)('preserves the current item in %s exception children without leaking siblings', async kind => {
    const items = [repositoryListItem('first'), repositoryListItem('second')]
    vi.mocked(executeProjectAssetOperation).mockReturnValue(items)
    const failed: WorkflowOperationNode = {
      ...operation('failed'), assetId: undefined, assetSource: 'input',
      inputs: { repositoryId: '$prev.id', branch: 'existing', source: '$root.source' },
    }
    const handler: WorkflowOperationNode = {
      ...operationNode('handler'), assetId: undefined, assetSource: 'input',
      inputs: { repositoryId: '$prev.id', branch: '$prev.name', source: '$prev.error.code' },
    }
    const run = runFixture([listNode(), { ...asyncNode(), kind }, failed, handler], [
      edge('workflow-trigger', 'items'), edge('items', 'parallel'), edge('parallel', 'failed', 'item'), edge('failed', 'handler', 'exists'),
    ])
    run.root = { source: 'main' }

    await start(run)

    expect(step(run, 'handler').executions?.filter(execution => execution.status !== 'skipped').map(execution => ({
      status: execution.status, inputs: execution.resolvedInputs,
    }))).toEqual(items.map(item => ({
      status: 'succeeded', inputs: { repositoryId: item.id, branch: item.name, source: ports[0].code },
    })))
    expect(run.status).toBe('succeeded')
    expect(step(run, 'failed').executions?.map(execution => execution.status)).toEqual(['handled', 'handled'])
    expect(items).toEqual([repositoryListItem('first'), repositoryListItem('second')])
  })

  test('keeps numeric array paths available through an exception edge', async () => {
    vi.mocked(executeProjectAssetOperation).mockReturnValue([repositoryListItem('first')])
    const failed = operation('failed')
    failed.inputs.branch = 'existing'
    const handler = operationNode('handler')
    handler.inputs.branch = '$prev.0.name'
    handler.inputs.source = '$prev.error.message'
    const run = runFixture([listNode(), failed, handler], [
      edge('workflow-trigger', 'items'), edge('items', 'failed'), edge('failed', 'handler', 'exists'),
    ])

    await start(run)

    expect(step(run, 'handler')).toMatchObject({
      status: 'succeeded', resolvedInputs: { branch: 'feature/first', source: 'branch-exists' },
    })
  })

  test('nested exception paths retain nested values and replace only the reserved error field', async () => {
    const failed = operation('failed')
    failed.inputs.branch = 'existing'
    const handler = operation('handler')
    handler.inputs.branch = '$prev.request.branch'
    handler.inputs.source = '$prev.error.code'
    handler.exceptionPorts = [{ id: 'missing', code: 'repository.source-not-found' }]
    vi.mocked(executeAssetOperation).mockImplementationOnce(async () => {
      throw createAssetOperationError(409, ports[0].code, 'Branch exists')
    }).mockImplementationOnce(async () => {
      throw createAssetOperationError(404, 'repository.source-not-found', 'source-missing')
    })
    const fallback = operationNode('fallback')
    fallback.inputs.branch = '$prev.request.branch'
    fallback.inputs.source = '$prev.error.message'
    const run = runFixture([failed, handler, fallback], [
      edge('workflow-trigger', 'failed'), edge('failed', 'handler', 'exists'), edge('handler', 'fallback', 'missing'),
    ])
    run.root = { request: { branch: 'feature/recovery' }, error: { code: 'old-code', message: 'old-message' } }

    await start(run)

    expect(step(run, 'handler').resolvedInputs).toMatchObject({ branch: 'feature/recovery', source: ports[0].code })
    expect(step(run, 'fallback')).toMatchObject({
      status: 'succeeded', resolvedInputs: { branch: 'feature/recovery', source: 'source-missing' },
    })
    expect(run.root.error).toEqual({ code: 'old-code', message: 'old-message' })
    expect(run.status).toBe('succeeded')
  })
})

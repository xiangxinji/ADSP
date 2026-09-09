import { beforeEach, describe, expect, test, vi } from 'vitest'
import { executeAssetOperation } from '../server/services/asset-operations'
import { executeProjectAssetOperation } from '../server/services/project-asset-operations'
import { executeWorkflowGraph } from '../server/services/workflow-graph-execution'
import { createAssetOperationError } from '../server/utils/asset-operation-error'
import type { WorkflowOperationNode } from '../shared/types/asdp'
import type { WorkflowRun } from '../shared/types/workflow-runs'
import { listNode, repositoryListItem, operationNode, runFixture, syncNode, workflowEdge as edge } from './support/workflow-fixtures'

vi.mock('../server/services/asset-operations', () => ({ executeAssetOperation: vi.fn() }))
vi.mock('../server/services/project-asset-operations', () => ({ executeProjectAssetOperation: vi.fn() }))
vi.mock('../server/repositories/workflow-runs', () => ({ updateWorkflowRun: vi.fn() }))

const start = (run: WorkflowRun) => executeWorkflowGraph(run, new Map(run.workflow.nodes.flatMap(node => 'inputs' in node ? [[node.id, node.inputs]] : [])))
const step = (run: WorkflowRun, id: string) => run.steps.find(step => step.nodeId === id)!
const commandInput = (index: number) => vi.mocked(executeAssetOperation).mock.calls[index]?.[3]

describe('workflow value execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(executeAssetOperation).mockImplementation(async (_assetType, assetId, _operationId, input) => {
      const value = input as { branch: string, source: string }
      return { repositoryId: assetId, branch: value.branch, source: value.source }
    })
  })

  test('passes nested root values into the first node and previous output into the next node', async () => {
    const first = operationNode('first')
    first.inputs.branch = '$root.releases.0.branch'
    const second = operationNode('second')
    second.inputs.branch = '$root.releases.1.branch'
    second.inputs.source = '$prev.branch'
    const run = runFixture([first, second], [edge('workflow-trigger', 'first'), edge('first', 'second')])
    run.root = { releases: [{ branch: 'feature/value-first' }, { branch: 'feature/value-second' }] }

    await start(run)

    expect(commandInput(0)).toEqual({ branch: 'feature/value-first', source: 'main' })
    expect(commandInput(1)).toEqual({ branch: 'feature/value-second', source: 'feature/value-first' })
    expect(step(run, 'second').resolvedInputs).toEqual({
      repositoryId: 'second', branch: 'feature/value-second', source: 'feature/value-first',
    })
  })

  test('passes the current array item to the child and control output to its outlet', async () => {
    vi.mocked(executeProjectAssetOperation).mockReturnValue([repositoryListItem('nested-child')])
    const child = operationNode('child')
    child.inputs.branch = '$prev.name'
    const done = operationNode('done')
    done.inputs.branch = '$root.done.branch'
    done.inputs.source = '$prev.selectedPort'
    const run = runFixture([listNode(), syncNode(), child, done], [
      edge('workflow-trigger', 'items'), edge('items', 'sequence'), edge('sequence', 'child', 'item'), edge('sequence', 'done', 'complete'),
    ])
    run.root = { release: { branch: 'feature/nested-child' }, done: { branch: 'feature/nested-done' } }

    await start(run)

    expect(commandInput(0)).toEqual({ branch: 'feature/nested-child', source: 'main' })
    expect(commandInput(1)).toEqual({ branch: 'feature/nested-done', source: 'complete' })
    expect(run.status).toBe('succeeded')
  })

  test('exposes an operation error as the previous value on its matching exception path', async () => {
    const failed: WorkflowOperationNode = {
      ...operationNode('failed'),
      exceptionPorts: [{ id: 'exists', code: 'repository.branch-already-exists' }],
    }
    const handler = operationNode('handler')
    handler.inputs.source = '$prev.error.code'
    vi.mocked(executeAssetOperation).mockImplementationOnce(async () => {
      throw createAssetOperationError(409, 'repository.branch-already-exists', 'Branch exists')
    })
    const run = runFixture([failed, handler], [edge('workflow-trigger', 'failed'), edge('failed', 'handler', 'exists')])

    await start(run)

    expect(commandInput(1)).toEqual({ branch: 'feature/handler', source: 'repository.branch-already-exists' })
    expect(run.status).toBe('failed')
  })

  test('fails before invoking a command when a reference path is unavailable', async () => {
    const node = operationNode('missing')
    node.inputs.branch = '$root.release.branch'
    const run = runFixture([node], [edge('workflow-trigger', 'missing')])

    await start(run)

    expect(executeAssetOperation).not.toHaveBeenCalled()
    expect(step(run, 'missing').error?.code).toBe('workflow.input-reference-not-found')
  })

  test('does not propagate an operation result that violates its declared output type', async () => {
    vi.mocked(executeAssetOperation).mockResolvedValueOnce({
      repositoryId: 'invalid-output', branch: 'feature/invalid-output', source: true,
    } as never)
    const run = runFixture(
      [operationNode('invalid-output'), operationNode('never')],
      [edge('workflow-trigger', 'invalid-output'), edge('invalid-output', 'never')],
    )

    await start(run)

    expect(step(run, 'invalid-output').error?.code).toBe('workflow.operation-failed')
    expect(step(run, 'invalid-output').output).toBeNull()
    expect(step(run, 'never').status).toBe('skipped')
  })
})

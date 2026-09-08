import { describe, expect, test } from 'vitest'
import { analyzeWorkflowGraph, validateWorkflowEdges } from '../shared/utils/workflow-graph'
import { workflowOutputPorts } from '../shared/utils/workflow-nodes'
import { operationNode, workflowEdge as edge } from './support/workflow-fixtures'

const operation = () => ({
  ...operationNode('operation'),
  exceptionPorts: [{ id: 'already-exists', code: 'repository.branch-already-exists' }],
})

describe('workflow operation exception ports', () => {
  test('retains the legacy normal outlet and exposes configured exception outlets', () => {
    expect(workflowOutputPorts(operationNode('legacy'))).toEqual([{ label: '执行' }])
    expect(workflowOutputPorts()).toEqual([{ label: '执行' }])
    expect(workflowOutputPorts(operation())).toEqual([
      { label: '执行' }, { id: 'already-exists', label: expect.stringContaining('repository.branch-already-exists') },
    ])
    expect(analyzeWorkflowGraph([operation(), operationNode('normal'), operationNode('handler')], [
      edge('workflow-trigger', 'operation'), edge('operation', 'normal'), edge('operation', 'handler', 'already-exists'),
    ], true)).toEqual({ message: '', orderedNodeIds: ['operation', 'normal', 'handler'] })
  })

  test.each([
    { exceptionPorts: [{ id: '', code: 'repository.branch-already-exists' }] },
    { exceptionPorts: [{ id: ' padded ', code: 'repository.branch-already-exists' }] },
    { exceptionPorts: [{ id: 'invalid', code: 'repository.unknown-error' }] },
    { exceptionPorts: [{ id: 'same', code: 'repository.branch-already-exists' }, { id: 'same', code: 'repository.source-not-found' }] },
    { exceptionPorts: [{ id: 'first', code: 'repository.branch-already-exists' }, { id: 'second', code: 'repository.branch-already-exists' }] },
  ])('rejects invalid exception declarations: $exceptionPorts', ({ exceptionPorts }) => {
    expect(analyzeWorkflowGraph([{ ...operation(), exceptionPorts }], [edge('workflow-trigger', 'operation')], true).message).not.toBe('')
  })

  test('permits unconnected exception ports but rejects nonexistent ports and cross-branch merging', () => {
    expect(analyzeWorkflowGraph([operation()], [edge('workflow-trigger', 'operation')], true).message).toBe('')
    const nodes = [operation(), operationNode('handler')]
    expect(validateWorkflowEdges(nodes, [edge('operation', 'handler', 'missing')])).toContain('端点')
    expect(validateWorkflowEdges(nodes, [edge('operation', 'handler'), edge('operation', 'handler', 'already-exists')])).toContain('上游')
    expect(validateWorkflowEdges(nodes, [edge('operation', 'handler', 'already-exists'), edge('handler', 'operation')])).toContain('环路')
  })
})

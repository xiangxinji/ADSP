import { describe, expect, test } from 'vitest'
import type { WorkflowControlNode, WorkflowEdge } from '../shared/types/asdp'
import { analyzeWorkflowGraph } from '../shared/utils/workflow-graph'
import { workflowOutputPorts } from '../shared/utils/workflow-nodes'
import { asyncNode, operationNode, workflowEdge as edge } from './support/workflow-fixtures'

describe.each(['async', 'sync'] as const)('%s fixed child graphs', kind => {
  const control = (): WorkflowControlNode => ({ ...asyncNode(), kind })
  const nodes = () => [control(), ...['child', 'next', 'done', 'error'].map(id => operationNode(id))]
  const edges = () => [
    edge('workflow-trigger', 'parallel'), edge('parallel', 'child', 'item'), edge('child', 'next'),
    edge('parallel', 'done', 'complete'), edge('parallel', 'error', 'error'),
  ]

  test('exposes exactly one execution port and two optional outcome outlets', () => {
    expect(workflowOutputPorts(control()).map(port => port.id)).toEqual(['item', 'complete', 'error'])
    expect(analyzeWorkflowGraph(nodes().reverse(), edges().reverse(), true)).toEqual({
      message: '', orderedNodeIds: ['parallel', 'child', 'next', 'done', 'error'],
    })
    expect(analyzeWorkflowGraph(nodes().slice(0, 2), edges().slice(0, 2), true).message).toBe('')
    expect(analyzeWorkflowGraph([control()], edges().slice(0, 1), true).message).toContain('子端点')
  })

  test.each([undefined, 'missing', 'first', ' item '])('rejects non-fixed child handle %s', sourceHandle => {
    const connections: WorkflowEdge[] = edges()
    connections[1] = { ...connections[1], sourceHandle }
    expect(analyzeWorkflowGraph(nodes(), connections, true).message).toContain('端点')
  })

  test('rejects multiple children and crossing paths', () => {
    expect(analyzeWorkflowGraph(nodes(), [...edges(), edge('parallel', 'next', 'item')], true).message).toContain('一个下游')
    expect(analyzeWorkflowGraph(nodes(), [...edges().filter(connection => connection.sourceHandle !== 'complete'), edge('parallel', 'child', 'complete')], true).message).toContain('一个上游')
  })

  test('rejects manually configured endpoints', () => {
    for (const branches of [[], [{ id: 'item', label: '自定义' }], [{ id: 'first', label: '旧端点' }],
      [{ id: 'item', label: '逐项执行' }, { id: 'second', label: '第二个' }]]) {
      expect(analyzeWorkflowGraph([{ ...control(), branches }, operationNode('child')], edges().slice(0, 2), true).message).toContain('固定')
    }
  })

  test('rejects orphan nodes, cycles and reserved node IDs', () => {
    expect(analyzeWorkflowGraph([...nodes(), operationNode('orphan')], edges(), true).message).not.toBe('')
    expect(analyzeWorkflowGraph(nodes(), [...edges(), edge('next', 'parallel')], true).message).not.toBe('')
    expect(analyzeWorkflowGraph([operationNode('workflow-trigger')], [], true).message).not.toBe('')
  })

  test('supports nested controls with independent completion and error paths', () => {
    expect(analyzeWorkflowGraph([control(), { ...control(), id: 'nested' }, operationNode('child'), operationNode('done')], [
      edge('workflow-trigger', 'parallel'), edge('parallel', 'nested', 'item'), edge('nested', 'child', 'item'), edge('parallel', 'done', 'complete'),
    ], true).message).toBe('')
  })
})

import { describe, expect, test } from 'vitest'
import type { WorkflowAsyncNode, WorkflowEdge, WorkflowNode } from '../shared/types/asdp'
import { analyzeWorkflowGraph } from '../shared/utils/workflow-graph'

const operation = (id: string): WorkflowNode => ({
  id, assetType: 'repository', assetId: 'repository-1', operationId: 'repository.create-branch',
  inputs: {}, position: { x: 0, y: 0 },
})
const parallel = (id = 'parallel'): WorkflowAsyncNode => ({
  id, kind: 'async', label: '异步执行', position: { x: 0, y: 0 },
  branches: [{ id: 'first', label: '子流程 1' }, { id: 'second', label: '子流程 2' }],
})
const edge = (source: string, target: string, sourceHandle?: string): WorkflowEdge => ({
  id: [source, sourceHandle || 'next', target].join('-'), source, target, ...(sourceHandle ? { sourceHandle } : {}),
})
const nodes = () => [parallel(), ...['first', 'next', 'second', 'done', 'error'].map(operation)]
const edges = () => [
  edge('workflow-trigger', 'parallel'), edge('parallel', 'first', 'first'), edge('first', 'next'),
  edge('parallel', 'second', 'second'), edge('parallel', 'done', 'complete'), edge('parallel', 'error', 'error'),
]

describe('async workflow graphs', () => {
  test('orders branches and mutually exclusive outlets without requiring a merge node', () => {
    expect(analyzeWorkflowGraph(nodes().reverse(), edges().reverse(), true)).toEqual({
      message: '', orderedNodeIds: ['parallel', 'first', 'next', 'second', 'done', 'error'],
    })
  })

  test('allows unused ports and optional complete/error outlets, but needs a connected branch', () => {
    expect(analyzeWorkflowGraph([parallel(), operation('first')], edges().slice(0, 2), true).message).toBe('')
    expect(analyzeWorkflowGraph([parallel()], edges().slice(0, 1), true).message).toContain('子端点')
  })

  test.each([undefined, 'missing', ' first '])('rejects invalid async source handle %s', (sourceHandle) => {
    const connections = edges()
    connections[1] = { ...connections[1], sourceHandle }
    expect(analyzeWorkflowGraph(nodes(), connections, true).message).toContain('端点')
  })

  test('rejects a second connection on one port or a shared branch target', () => {
    expect(analyzeWorkflowGraph(nodes(), [...edges(), edge('parallel', 'next', 'first')], true).message).toContain('一个下游')
    const connections = edges().filter(connection => connection.target !== 'second')
    expect(analyzeWorkflowGraph(nodes(), [...connections, edge('parallel', 'first', 'second')], true).message).not.toBe('')
  })

  test('rejects handles on operation nodes and the root trigger', () => {
    for (const edgeIndex of [0, 2]) {
      const connections = edges()
      connections[edgeIndex] = { ...connections[edgeIndex], sourceHandle: 'complete' }
      expect(analyzeWorkflowGraph(nodes(), connections, true).message).toContain('端点')
    }
  })

  test('rejects duplicate, empty or reserved branch IDs and empty labels', () => {
    for (const branches of [
      [], [{ id: '', label: 'Empty' }], [{ id: 'complete', label: 'Reserved' }], [{ id: 'error', label: 'Reserved' }],
      [{ id: 'first', label: '' }], [{ id: 'first', label: 'One' }, { id: 'first', label: 'Two' }],
    ]) {
      expect(analyzeWorkflowGraph([{ ...parallel(), branches }, operation('first')], edges().slice(0, 2), true).message).not.toBe('')
    }
  })

  test('rejects disconnected nodes, branch cycles and reserved node IDs', () => {
    expect(analyzeWorkflowGraph([...nodes(), operation('orphan')], edges(), true).message).not.toBe('')
    expect(analyzeWorkflowGraph(nodes(), [...edges(), edge('next', 'parallel')], true).message).not.toBe('')
    expect(analyzeWorkflowGraph([operation('workflow-trigger')], [], true).message).not.toBe('')
  })

  test('supports nested async nodes with separate completion and error paths', () => {
    const nestedNodes = [parallel(), parallel('nested'), operation('leaf'), operation('after'), operation('handled')]
    const nestedEdges = [
      edge('workflow-trigger', 'parallel'), edge('parallel', 'nested', 'first'),
      edge('nested', 'leaf', 'first'), edge('nested', 'after', 'complete'), edge('parallel', 'handled', 'error'),
    ]
    expect(analyzeWorkflowGraph(nestedNodes, nestedEdges, true).message).toBe('')
  })
})

import { describe, expect, test } from 'vitest'
import { analyzeWorkflowGraph, workflowTriggerNodeId } from '../shared/utils/workflow-graph'

const edge = (id: string, source: string, target: string) => ({ id, source, target })

describe('workflow graph analysis', () => {
  test('orders a connected linear graph from the root trigger', () => {
    expect(analyzeWorkflowGraph(['node-b', 'node-a'], [
      edge('edge-root', workflowTriggerNodeId, 'node-a'),
      edge('edge-next', 'node-a', 'node-b'),
    ], true)).toEqual({ message: '', orderedNodeIds: ['node-a', 'node-b'] })
  })

  test('rejects disconnected, branching, and cyclic graphs', () => {
    expect(analyzeWorkflowGraph(['node-a'], [], true).message).toContain('根触发器')
    expect(analyzeWorkflowGraph(['node-a', 'node-b'], [
      edge('edge-a', workflowTriggerNodeId, 'node-a'),
      edge('edge-b', workflowTriggerNodeId, 'node-b'),
    ], true).message).toContain('一个下游')
    expect(analyzeWorkflowGraph(['node-a', 'node-b'], [
      edge('edge-root', workflowTriggerNodeId, 'node-a'),
      edge('edge-next', 'node-a', 'node-b'),
      edge('edge-cycle', 'node-b', 'node-a'),
    ], true).message).toContain('一个上游')
  })

  test('allows a trigger-only workflow without edges', () => {
    expect(analyzeWorkflowGraph([], [], true)).toEqual({ message: '', orderedNodeIds: [] })
  })
})

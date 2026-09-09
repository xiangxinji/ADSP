import { describe, expect, test } from 'vitest'
import { analyzeWorkflowGraph } from '../shared/utils/workflow-graph'
import { analyzeWorkflowReferences, workflowNestingLimit } from '../shared/utils/workflow-references'
import { isWorkflowOperationNode, validateWorkflowSubworkflowNode, workflowNodeLabel, workflowOutputPorts } from '../shared/utils/workflow-nodes'
import { listNode, subworkflowNode, workflowFixture, workflowEdge as edge } from './support/workflow-fixtures'

const definition = (id: string, children: string[] = []) => ({
  ...workflowFixture(children.map((child, index) => subworkflowNode(child, 'call-' + index)), []), id,
})

describe('subworkflow references', () => {
  test('treats a workflow call as a single normal-output node rather than an asset operation', () => {
    const node = subworkflowNode()
    expect(isWorkflowOperationNode(node)).toBe(false)
    expect(workflowNodeLabel(node)).toBe(node.label)
    expect(workflowOutputPorts(node)).toEqual([{ label: '执行' }])
    expect(validateWorkflowSubworkflowNode({ ...node, workflowId: '' })).toContain('请选择')
    expect(analyzeWorkflowGraph([node, listNode()], [edge('workflow-trigger', 'call'), edge('call', 'items')], true).message).toBe('')
  })

  test('allows repeated calls and shared descendants without treating them as cycles', () => {
    const workflows = [definition('parent', ['left', 'right', 'left']), definition('left', ['leaf']), definition('right', ['leaf']), definition('leaf')]
    const result = analyzeWorkflowReferences(workflows[0]!, id => workflows.find(workflow => workflow.id === id))
    expect(result.error).toBeNull()
    expect(result.workflows.map(workflow => workflow.id)).toEqual(['parent', 'left', 'leaf', 'right'])
  })

  test.each([{ chain: ['parent'] }, { chain: ['child', 'parent'] }])('rejects recursive call chains $chain', ({ chain }) => {
    const workflows = [definition('parent', [chain[0]!]), ...chain.filter(id => id !== 'parent').map(id => definition(id, ['parent']))]
    expect(analyzeWorkflowReferences(workflows[0]!, id => workflows.find(workflow => workflow.id === id)).error?.code).toBe('workflow.subworkflow-cycle')
  })

  test('rejects missing and foreign-project targets', () => {
    const parent = definition('parent', ['child'])
    expect(analyzeWorkflowReferences(parent, () => undefined).error?.code).toBe('workflow.subworkflow-not-found')
    expect(analyzeWorkflowReferences(parent, () => ({ ...definition('child'), projectId: 'foreign' })).error?.code).toBe('workflow.subworkflow-project-mismatch')
  })

  test('enforces depth even when a long shared suffix was already visited', () => {
    const workflows = Array.from({ length: workflowNestingLimit + 1 }, (_, index) => definition(String(index), index < workflowNestingLimit ? [String(index + 1)] : []))
    const find = (id: string) => workflows.find(workflow => workflow.id === id)
    expect(analyzeWorkflowReferences(workflows[1]!, find).error).toBeNull()
    workflows[0]!.nodes.unshift(subworkflowNode(String(workflowNestingLimit - 1), 'short-path'))
    expect(analyzeWorkflowReferences(workflows[0]!, find).error?.code).toBe('workflow.subworkflow-depth-exceeded')
  })
})

import { computed, ref } from 'vue'
import { describe, expect, test } from 'vitest'
import { useWorkflowExceptionPorts } from '../app/composables/useWorkflowExceptionPorts'
import { useWorkflowConnections } from '../app/composables/useWorkflowConnections'
import { workflowOperationExceptions } from '../shared/utils/workflow-nodes'
import type { WorkflowDefinition, WorkflowOperationNode } from '../shared/types/asdp'
import { asyncNode, operationNode, workflowEdge as edge, workflowFixture } from './support/workflow-fixtures'

const setup = () => {
  const draft = ref<WorkflowDefinition | null>(workflowFixture([operationNode('root'), operationNode('child'), asyncNode()], [edge('workflow-trigger', 'root')]))
  const selectedNodeId = ref<string | null>('child')
  const selectedNode = computed(() => draft.value?.nodes.find(node => node.id === selectedNodeId.value) || null)
  const actionError = ref('')
  return {
    draft, selectedNodeId, actionError, node: draft.value!.nodes[0] as WorkflowOperationNode,
    ...useWorkflowExceptionPorts(draft, selectedNodeId, actionError),
    ...useWorkflowConnections(draft, selectedNode, actionError),
  }
}

describe('workflow exception port editing', () => {
  test('adds unique contract-backed ports and selects the owning node', () => {
    const editor = setup()
    editor.addExceptionPort('root')
    editor.addExceptionPort('root')
    expect(editor.selectedNodeId.value).toBe('root')
    const ports = editor.node.exceptionPorts!
    expect(ports).toHaveLength(2)
    expect(ports[0].id).not.toBe(ports[1].id)
    expect(ports.map(port => port.code)).toEqual(workflowOperationExceptions(editor.node).slice(0, 2).map(exception => exception.code))
    expect(editor.actionError.value).toBe('')
  })

  test('changing codes retains connections and deleting a port keeps its child node', () => {
    const editor = setup()
    editor.addExceptionPort('root')
    const portId = editor.node.exceptionPorts![0].id
    editor.selectedNodeId.value = 'child'
    editor.setUpstream({ source: 'root', sourceHandle: portId })
    const originalEdges = JSON.stringify(editor.draft.value!.edges)
    editor.updateExceptionPort('root', portId, 'repository.branch-already-exists')
    expect(editor.node.exceptionPorts![0]).toEqual({ id: portId, code: 'repository.branch-already-exists' })
    expect(JSON.stringify(editor.draft.value!.edges)).toBe(originalEdges)
    editor.removeExceptionPort('root', portId)
    expect(editor.node.exceptionPorts).toEqual([])
    expect(editor.draft.value!.edges).toEqual([edge('workflow-trigger', 'root')])
    expect(editor.draft.value!.nodes.some(node => node.id === 'child')).toBe(true)
  })

  test('rejects duplicate and undeclared codes without mutating existing configuration', () => {
    const editor = setup()
    editor.addExceptionPort('root')
    editor.addExceptionPort('root')
    const before = JSON.stringify(editor.node)
    const [first, second] = editor.node.exceptionPorts!
    editor.updateExceptionPort('root', first.id, second.code)
    expect(editor.actionError.value).toContain('已配置')
    editor.updateExceptionPort('root', first.id, 'repository.not-declared')
    expect(editor.actionError.value).toContain('契约')
    expect(JSON.stringify(editor.node)).toBe(before)
  })

  test('limits ports to available exceptions and ignores missing or async nodes', () => {
    const editor = setup()
    const count = workflowOperationExceptions(editor.node).length
    for (let index = 0; index <= count; index += 1) editor.addExceptionPort('root')
    expect(editor.node.exceptionPorts).toHaveLength(count)
    expect(editor.actionError.value).toContain('没有可添加')
    const before = JSON.stringify(editor.draft.value)
    editor.addExceptionPort('parallel')
    editor.addExceptionPort('missing')
    editor.removeExceptionPort('root', 'missing')
    expect(JSON.stringify(editor.draft.value)).toBe(before)
  })
})

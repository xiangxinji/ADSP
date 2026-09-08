import { computed, ref } from 'vue'
import { describe, expect, test } from 'vitest'
import type { WorkflowDefinition } from '../shared/types/asdp'
import { useWorkflowAsyncNodes } from '../app/composables/useWorkflowAsyncNodes'
import { useWorkflowConnections } from '../app/composables/useWorkflowConnections'
import { asyncNode, operationNode, workflowEdge as edge, workflowFixture } from './support/workflow-fixtures'

const setup = () => {
  const draft = ref<WorkflowDefinition | null>(workflowFixture([asyncNode(), operationNode('leaf'), operationNode('other')], [
    edge('workflow-trigger', 'parallel'), edge('parallel', 'leaf', 'first'), edge('parallel', 'other', 'complete'),
  ]))
  const selectedNodeId = ref<string | null>('leaf')
  const selectedNode = computed(() => draft.value?.nodes.find(node => node.id === selectedNodeId.value) || null)
  const actionError = ref('')
  return {
    draft, selectedNodeId, actionError,
    ...useWorkflowAsyncNodes(draft, selectedNodeId, actionError),
    ...useWorkflowConnections(draft, selectedNode, actionError),
  }
}

describe('async workflow editing', () => {
  test('adds a selected control node with stable, distinct child port IDs', () => {
    const editor = setup()
    editor.addAsyncNode()
    const node = editor.draft.value!.nodes.at(-1)!
    expect(node.kind).toBe('async')
    if (node.kind !== 'async') throw new Error('Expected async node')
    expect(editor.selectedNodeId.value).toBe(node.id)
    expect(new Set(node.branches.map(branch => branch.id)).size).toBe(2)
    editor.renameAsyncBranch(node.id, node.branches[0].id, '构建前端')
    const originalId = node.branches[0].id
    editor.addAsyncBranch(node.id)
    expect(node.branches).toHaveLength(3)
    expect(node.branches[0]).toEqual({ id: originalId, label: '构建前端' })
  })

  test('renaming retains edges and deleting a port removes only its own connection', () => {
    const editor = setup()
    const originalEdges = structuredClone(editor.draft.value!.edges.map(edge => ({ ...edge })))
    editor.renameAsyncBranch('parallel', 'first', '执行 A')
    expect(editor.draft.value!.edges).toEqual(originalEdges)
    editor.removeAsyncBranch('parallel', 'first')
    expect(editor.draft.value!.nodes.some(node => node.id === 'leaf')).toBe(true)
    expect(editor.draft.value!.edges).toEqual(originalEdges.filter(edge => edge.sourceHandle !== 'first'))
    editor.removeAsyncBranch('parallel', 'second')
    expect(editor.actionError.value).toContain('至少保留一个')
  })

  test('allows one edge per output port and supports changing upstream ports on the same node', () => {
    const editor = setup()
    editor.setUpstream({ source: 'parallel', sourceHandle: 'second' })
    expect(editor.actionError.value).toBe('')
    expect(editor.draft.value!.edges.find(edge => edge.target === 'leaf')?.sourceHandle).toBe('second')
    editor.connectEdge({ source: 'parallel', sourceHandle: 'second', target: 'other' })
    expect(editor.actionError.value).toContain('一个下游')
    editor.setUpstream(null)
    expect(editor.actionError.value).toBe('')
    expect(editor.draft.value!.edges.some(edge => edge.target === 'leaf')).toBe(false)
  })

  test('rejects cycles and unknown ports without replacing existing connections', () => {
    const editor = setup()
    const before = JSON.stringify(editor.draft.value!.edges)
    editor.setUpstream({ source: 'parallel', sourceHandle: 'missing' })
    expect(editor.actionError.value).toContain('端点')
    expect(JSON.stringify(editor.draft.value!.edges)).toBe(before)
    editor.selectedNodeId.value = 'parallel'
    editor.setUpstream({ source: 'leaf' })
    expect(editor.actionError.value).toContain('环路')
    expect(JSON.stringify(editor.draft.value!.edges)).toBe(before)
  })

  test('enforces trigger and branch-count limits before modifying the draft', () => {
    const editor = setup()
    editor.draft.value!.trigger = null
    editor.addAsyncNode()
    expect(editor.actionError.value).toContain('根触发器')
    expect(editor.draft.value!.nodes).toHaveLength(3)
    const node = editor.draft.value!.nodes[0]!
    if (node.kind !== 'async') throw new Error('Expected async node')
    node.branches = Array.from({ length: 50 }, (_, index) => ({ id: 'branch-' + index, label: '子流程 ' + index }))
    editor.addAsyncBranch(node.id)
    expect(editor.actionError.value).toContain('50')
    expect(node.branches).toHaveLength(50)
  })
})

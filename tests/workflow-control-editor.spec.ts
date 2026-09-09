import { computed, ref } from 'vue'
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import type { WorkflowControlKind, WorkflowDefinition } from '../shared/types/asdp'
import { isWorkflowControlNode, workflowControlBranch, workflowControlNames } from '../shared/utils/workflow-nodes'
import { useWorkflowControlNodes } from '../app/composables/useWorkflowControlNodes'
import { useWorkflowConnections } from '../app/composables/useWorkflowConnections'
import { asyncNode, operationNode, workflowEdge as edge, workflowFixture } from './support/workflow-fixtures'

const setup = (kind: WorkflowControlKind) => {
  const draft = ref<WorkflowDefinition | null>(workflowFixture([{ ...asyncNode(), kind }, operationNode('leaf'), operationNode('other')], [
    edge('workflow-trigger', 'parallel'), edge('parallel', 'leaf', 'item'), edge('parallel', 'other', 'complete'),
  ]))
  const selectedNodeId = ref<string | null>('leaf')
  const selectedNode = computed(() => draft.value?.nodes.find(node => node.id === selectedNodeId.value) || null)
  const actionError = ref('')
  return {
    draft, selectedNodeId, actionError,
    ...useWorkflowControlNodes(draft, selectedNodeId, actionError),
    ...useWorkflowConnections(draft, selectedNode, actionError),
  }
}

describe.each(['async', 'sync'] as const)('%s workflow editing', kind => {
  test('creates one fixed child endpoint without manual configuration', () => {
    const editor = setup(kind)
    const position = { x: 480, y: 320 }
    editor.addControlNode(kind, position)
    const node = editor.draft.value!.nodes.at(-1)!
    if (!isWorkflowControlNode(node)) throw new Error('Expected control node')
    expect(node).toMatchObject({ kind, position, label: workflowControlNames[kind], branches: [workflowControlBranch] })
    expect(editor.selectedNodeId.value).toBe(node.id)
    expect(editor).not.toHaveProperty('addControlBranch')
    expect(editor).not.toHaveProperty('renameControlBranch')
    expect(editor).not.toHaveProperty('removeControlBranch')
    expect(editor).not.toHaveProperty('moveControlBranch')
    editor.updateControlLabel(node.id, '处理全部仓库')
    expect(node.label).toBe('处理全部仓库')
    expect(node.branches).toEqual([workflowControlBranch])
  })

  test('allows only one child connection while retaining completion and error outlets', () => {
    const editor = setup(kind)
    editor.connectEdge({ source: 'parallel', sourceHandle: 'item', target: 'other' })
    expect(editor.actionError.value).toContain('一个下游')
    editor.setUpstream({ source: 'parallel', sourceHandle: 'error' })
    expect(editor.actionError.value).toBe('')
    editor.setUpstream({ source: 'parallel', sourceHandle: 'item' })
    expect(editor.actionError.value).toBe('')
    editor.setUpstream(null)
    expect(editor.draft.value!.edges.some(edge => edge.target === 'leaf')).toBe(false)
  })

  test('rejects cycles and manual ports without replacing connections', () => {
    const editor = setup(kind)
    const before = JSON.stringify(editor.draft.value!.edges)
    editor.setUpstream({ source: 'parallel', sourceHandle: 'second' })
    expect(editor.actionError.value).toContain('端点')
    expect(JSON.stringify(editor.draft.value!.edges)).toBe(before)
    editor.selectedNodeId.value = 'parallel'
    editor.setUpstream({ source: 'leaf' })
    expect(editor.actionError.value).toContain('环路')
    expect(JSON.stringify(editor.draft.value!.edges)).toBe(before)
  })

  test('enforces trigger and node limits', () => {
    const editor = setup(kind)
    editor.draft.value!.trigger = null
    editor.addControlNode(kind)
    expect(editor.actionError.value).toContain('根触发器')
    expect(editor.draft.value!.nodes).toHaveLength(3)
    editor.draft.value!.trigger = { kind: 'manual', position: { x: 0, y: 0 } }
    editor.draft.value!.nodes = Array.from({ length: 50 }, (_, index) => operationNode('node-' + index))
    editor.addControlNode(kind)
    expect(editor.actionError.value).toContain('50')
    expect(editor.draft.value!.nodes).toHaveLength(50)
  })
})

test('the control node and inspector no longer expose endpoint editing', () => {
  for (const file of ['WorkflowControlNode.vue', 'WorkflowControlInspector.vue']) {
    const source = readFileSync(new URL('../app/components/workflow/' + file, import.meta.url), 'utf8')
    expect(source).not.toMatch(/addBranch|renameBranch|removeBranch|moveBranch|添加子端点|删除子端点/)
    expect(source).toContain('数组')
  }
})

import { computed, nextTick, ref } from 'vue'
import { describe, expect, test, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ProjectWorkspace, WorkflowDefinition } from '../shared/types/asdp'
import { useWorkflowSubworkflows } from '../app/composables/useWorkflowSubworkflows'
import { useWorkflowConnections } from '../app/composables/useWorkflowConnections'
import { useWorkflowNodeDrop } from '../app/composables/useWorkflowNodeDrop'
import { parseWorkflowNodeDragData, serializeWorkflowNodeDragData } from '../app/utils/workflow-node-drag'
import { isWorkflowSubworkflowNode } from '../shared/utils/workflow-nodes'
import { listNode, workflowFixture } from './support/workflow-fixtures'

describe('workflow node editor', () => {
  test('adds, selects, configures and connects a workflow node without asset inputs', () => {
    const draft = ref<WorkflowDefinition | null>(workflowFixture([], []))
    const child = { ...workflowFixture([listNode()], []), id: 'child', name: '复用工作流' }
    const workspace = ref({ workflows: [child] } as ProjectWorkspace)
    const selectedNodeId = ref<string | null>(null)
    const error = ref('')
    const editor = useWorkflowSubworkflows(draft, workspace, selectedNodeId, error)
    editor.addSubworkflow({ x: 480, y: 180 })
    const node = draft.value!.nodes[0]!
    expect(isWorkflowSubworkflowNode(node)).toBe(true)
    expect(node).toMatchObject({ kind: 'workflow', workflowId: '', position: { x: 480, y: 180 } })
    expect(node).not.toHaveProperty('inputs')
    expect(selectedNodeId.value).toBe(node.id)
    editor.updateSubworkflow('child')
    expect(node).toMatchObject({ workflowId: child.id, label: child.name })
    editor.updateSubworkflowLabel('执行准备流程')
    expect(node).toHaveProperty('label', '执行准备流程')
    const connections = useWorkflowConnections(draft, computed(() => node), error)
    connections.connectEdge({ source: 'workflow-trigger', target: node.id })
    expect(error.value).toBe('')
    expect(draft.value!.edges).toHaveLength(1)
    editor.updateSubworkflow('missing')
    expect(node).toHaveProperty('workflowId', child.id)
  })

  test('requires a trigger, honors the node limit and rejects foreign or self references', () => {
    const draft = ref<WorkflowDefinition | null>(workflowFixture([], []))
    const selected = ref<string | null>(null)
    const error = ref('')
    const foreign = { ...workflowFixture([], []), id: 'foreign', projectId: 'other' }
    const workspace = ref({ workflows: [draft.value!, foreign] } as ProjectWorkspace)
    const editor = useWorkflowSubworkflows(draft, workspace, selected, error)
    editor.addSubworkflow()
    editor.updateSubworkflow(draft.value!.id)
    editor.updateSubworkflow(foreign.id)
    expect(draft.value!.nodes[0]).toHaveProperty('workflowId', '')
    draft.value!.trigger = null
    editor.addSubworkflow()
    expect(error.value).toContain('根触发器')
    draft.value!.trigger = { kind: 'manual', position: { x: 0, y: 0 } }
    draft.value!.nodes = Array.from({ length: 50 }, (_, index) => listNode(String(index)))
    editor.addSubworkflow()
    expect(error.value).toContain('50')
  })

  test('supports drag data and exposes internal run and iteration details', () => {
    expect(parseWorkflowNodeDragData(serializeWorkflowNodeDragData({ type: 'workflow' }))).toEqual({ type: 'workflow' })
    const component = (name: string) => readFileSync(new URL('../app/components/workflow/' + name + '.vue', import.meta.url), 'utf8')
    expect(component('WorkflowNodeLibrary')).toContain("emit('addSubworkflow')")
    expect(component('WorkflowCanvas')).toContain('#node-workflow')
    expect(component('WorkflowRunPanel')).toContain('<WorkflowRunStepDetail')
    expect(component('WorkflowRunStepDetail')).toContain('selectedStep.childRun')
    expect(component('WorkflowNestedRun')).toContain('内部节点执行进度')
    expect(component('WorkflowNestedStep')).toContain('step.executions')
    expect(component('WorkflowNestedStep')).toContain('step.childRun')
  })

  test('drops a workflow node at canvas coordinates and ignores read-only drops', async () => {
    const addNode = vi.fn()
    let readOnly = false
    const drop = useWorkflowNodeDrop(() => readOnly, point => point, addNode)
    const event = {
      clientX: 500, clientY: 200, preventDefault: vi.fn(),
      dataTransfer: { types: ['application/x-forgepilot-workflow-node'], getData: () => '{"type":"workflow"}' },
    } as unknown as DragEvent
    drop.onDragOver(event)
    expect(drop.dragOver.value).toBe(true)
    drop.onDrop(event)
    expect(addNode).toHaveBeenCalledWith({ type: 'workflow', position: { x: 366, y: 157 } })
    expect(drop.dragOver.value).toBe(false)
    expect(drop.skipNextNodeFit.value).toBe(true)
    await nextTick()
    expect(drop.skipNextNodeFit.value).toBe(false)
    readOnly = true
    drop.onDrop(event)
    expect(addNode).toHaveBeenCalledTimes(1)
  })
})

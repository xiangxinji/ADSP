import type { Ref } from 'vue'
import type { ProjectWorkspace, WorkflowDefinition, WorkflowNodePosition } from '#shared/types/asdp'
import { isWorkflowSubworkflowNode, workflowNodeLimit } from '#shared/utils/workflow-nodes'

export const useWorkflowSubworkflows = (
  draft: Ref<WorkflowDefinition | null>,
  workspace: Ref<ProjectWorkspace | null | undefined>,
  selectedNodeId: Ref<string | null>,
  actionError: Ref<string>,
) => {
  const addSubworkflow = (position?: WorkflowNodePosition) => {
    if (!draft.value) return
    if (!draft.value.trigger || draft.value.nodes.length >= workflowNodeLimit) {
      actionError.value = !draft.value.trigger ? '请先选择根触发器。' : '工作流最多支持 50 个节点。'
      return
    }
    const previous = draft.value.nodes.at(-1)?.position || draft.value.trigger.position
    const node = {
      id: globalThis.crypto.randomUUID(), kind: 'workflow' as const, label: '工作流', workflowId: '',
      position: position || { x: previous.x, y: previous.y + 180 },
    }
    draft.value.nodes.push(node)
    selectedNodeId.value = node.id
    actionError.value = ''
  }
  const updateSubworkflow = (workflowId: string) => {
    const node = draft.value?.nodes.find(node => node.id === selectedNodeId.value)
    const target = workspace.value?.workflows.find(workflow => workflow.id === workflowId)
    if (!isWorkflowSubworkflowNode(node) || !target || target.projectId !== draft.value?.projectId || target.id === draft.value.id) return
    node.workflowId = target.id
    node.label = target.name
  }
  const updateSubworkflowLabel = (label: string) => {
    const node = draft.value?.nodes.find(node => node.id === selectedNodeId.value)
    if (isWorkflowSubworkflowNode(node)) node.label = label
  }
  return { addSubworkflow, updateSubworkflow, updateSubworkflowLabel }
}

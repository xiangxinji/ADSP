import type { Ref } from 'vue'
import type { WorkflowControlKind, WorkflowDefinition, WorkflowNodePosition } from '#shared/types/asdp'
import { isWorkflowControlNode, workflowControlBranch, workflowControlNames, workflowNodeLimit } from '#shared/utils/workflow-nodes'

export const useWorkflowControlNodes = (
  draft: Ref<WorkflowDefinition | null>,
  selectedNodeId: Ref<string | null>,
  actionError: Ref<string>,
) => {
  const addControlNode = (kind: WorkflowControlKind, position?: WorkflowNodePosition) => {
    if (!draft.value) return
    if (!draft.value.trigger || draft.value.nodes.length >= workflowNodeLimit) {
      actionError.value = !draft.value.trigger ? '请先选择根触发器。' : '工作流最多支持 50 个节点。'
      return
    }
    const previous = draft.value.nodes.at(-1)?.position || draft.value.trigger.position
    const node = {
      id: globalThis.crypto.randomUUID(), kind, label: workflowControlNames[kind],
      branches: [{ ...workflowControlBranch }],
      position: position || { x: previous.x, y: previous.y + 220 },
    }
    draft.value.nodes.push(node)
    selectedNodeId.value = node.id
    actionError.value = ''
  }
  const updateControlLabel = (nodeId: string, label: string) => {
    const node = draft.value?.nodes.find(node => node.id === nodeId)
    if (isWorkflowControlNode(node)) node.label = label
  }
  return { addControlNode, updateControlLabel }
}

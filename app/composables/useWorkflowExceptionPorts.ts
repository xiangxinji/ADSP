import type { Ref } from 'vue'
import type { WorkflowDefinition } from '#shared/types/asdp'
import { isWorkflowOperationNode, workflowOperationExceptions } from '#shared/utils/workflow-nodes'

export const useWorkflowExceptionPorts = (
  draft: Ref<WorkflowDefinition | null>,
  selectedNodeId: Ref<string | null>,
  actionError: Ref<string>,
) => {
  const findOperationNode = (nodeId: string) => {
    const node = draft.value?.nodes.find(node => node.id === nodeId)
    return isWorkflowOperationNode(node) ? node : undefined
  }

  const addExceptionPort = (nodeId: string) => {
    const node = findOperationNode(nodeId)
    if (!node) return
    const exception = workflowOperationExceptions(node).find(exception => !node.exceptionPorts?.some(port => port.code === exception.code))
    if (!exception) {
      actionError.value = '当前操作没有可添加的异常错误码。'
      return
    }
    node.exceptionPorts = [...(node.exceptionPorts || []), { id: globalThis.crypto.randomUUID(), code: exception.code }]
    selectedNodeId.value = nodeId
    actionError.value = ''
  }

  const updateExceptionPort = (nodeId: string, portId: string, code: string) => {
    const node = findOperationNode(nodeId)
    const port = node?.exceptionPorts?.find(port => port.id === portId)
    if (!node || !port) return
    if (!workflowOperationExceptions(node).some(exception => exception.code === code)) {
      actionError.value = '请选择当前操作契约中声明的错误码。'
      return
    }
    if (node.exceptionPorts?.some(port => port.id !== portId && port.code === code)) {
      actionError.value = '该错误码已配置异常端点。'
      return
    }
    port.code = code
    actionError.value = ''
  }

  const removeExceptionPort = (nodeId: string, portId: string) => {
    const node = findOperationNode(nodeId)
    if (!draft.value || !node?.exceptionPorts?.some(port => port.id === portId)) return
    node.exceptionPorts = node.exceptionPorts.filter(port => port.id !== portId)
    draft.value.edges = draft.value.edges.filter(edge => edge.source !== nodeId || edge.sourceHandle !== portId)
    actionError.value = ''
  }

  return { addExceptionPort, updateExceptionPort, removeExceptionPort }
}

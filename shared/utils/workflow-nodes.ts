import { findAssetOperation } from '../config/asset-operations'
import type { WorkflowControlKind, WorkflowControlNode, WorkflowNode, WorkflowOperationNode } from '../types/asdp'

export const workflowNodeLimit = 50
export const workflowControlBranch = { id: 'item', label: '逐项执行' } as const
export const workflowControlNames: Record<WorkflowControlKind, string> = { async: '异步执行', sync: '同步执行' }

export const isWorkflowControlNode = (node?: WorkflowNode | null): node is WorkflowControlNode => node?.kind === 'async' || node?.kind === 'sync'

export const workflowNodeLabel = (node: WorkflowNode) => isWorkflowControlNode(node)
  ? node.label
  : findAssetOperation(node.assetType, node.operationId)?.label || node.operationId

export const workflowOutputPorts = (node?: WorkflowNode): { id?: string, label: string }[] => isWorkflowControlNode(node)
  ? [workflowControlBranch, { id: 'complete', label: '完成' }, { id: 'error', label: '异常' }]
  : [{ label: '执行' }, ...(node?.exceptionPorts || []).map(port => ({ id: port.id, label: '异常 · ' + port.code }))]

export const workflowOperationExceptions = (node: WorkflowOperationNode) => {
  const operation = findAssetOperation(node.assetType, node.operationId)
  return operation?.workflow.enabled ? operation.contract.exceptions : []
}

export const validateWorkflowExceptionPorts = (node: WorkflowOperationNode) => {
  const exceptions = workflowOperationExceptions(node)
  const ids = new Set<string>()
  const codes = new Set<string>()
  for (const port of node.exceptionPorts || []) {
    if (!port.id.trim() || port.id !== port.id.trim() || port.id.length > 100 || ids.has(port.id)) {
      return '异常端点 ID 必须为 1–100 个字符且唯一。'
    }
    if (!exceptions.some(exception => exception.code === port.code)) return '异常端点必须选择当前资产操作契约中声明的错误码。'
    if (codes.has(port.code)) return '同一操作节点的错误码只能配置一个异常端点。'
    ids.add(port.id)
    codes.add(port.code)
  }
  return ''
}

export const validateWorkflowControlNode = (node: WorkflowControlNode) => {
  const label = workflowControlNames[node.kind]
  if (!node.label.trim() || node.label.length > 100) return label + '节点名称必须为 1–100 个字符。'
  if (node.branches.length !== 1 || node.branches[0]?.id !== workflowControlBranch.id
    || node.branches[0]?.label !== workflowControlBranch.label) return label + '节点仅支持一个固定的逐项执行子端点，无需手动配置。'
  return ''
}

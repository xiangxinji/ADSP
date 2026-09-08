import { findAssetOperation } from '../config/asset-operations'
import type { WorkflowAsyncNode, WorkflowNode, WorkflowOperationNode } from '../types/asdp'

export const workflowNodeLimit = 50
export const workflowBranchLimit = 50
export const workflowAsyncOutlets = ['complete', 'error'] as const

export const workflowNodeLabel = (node: WorkflowNode) => node.kind === 'async'
  ? node.label
  : findAssetOperation(node.assetType, node.operationId)?.label || node.operationId

export const workflowOutputPorts = (node?: WorkflowNode): { id?: string, label: string }[] => node?.kind === 'async'
  ? [...node.branches, { id: 'complete', label: '完成' }, { id: 'error', label: '异常' }]
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

export const validateAsyncWorkflowNode = (node: WorkflowAsyncNode) => {
  if (!node.label.trim() || node.label.length > 100) return '异步节点名称必须为 1–100 个字符。'
  if (!node.branches.length || node.branches.length > workflowBranchLimit) return '异步节点必须保留 1–50 个子端点。'
  const ids = new Set<string>()
  for (const branch of node.branches) {
    if (!branch.id.trim() || branch.id !== branch.id.trim() || branch.id.length > 100 || ids.has(branch.id)
      || workflowAsyncOutlets.some(outlet => outlet === branch.id)) return '子端点 ID 必须唯一，且不能使用 complete 或 error。'
    if (!branch.label.trim() || branch.label.length > 50) return '子端点名称必须为 1–50 个字符。'
    ids.add(branch.id)
  }
  return ''
}

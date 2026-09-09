import { findAssetOperation } from '#shared/config/asset-operations'
import type { WorkflowDefinition } from '#shared/types/asdp'
import type { AssetOperationField } from '#shared/types/asset-operations'
import { assetOperationOutputFields } from '#shared/utils/asset-operation-contract'
import { isWorkflowControlNode, isWorkflowOperationNode } from '#shared/utils/workflow-nodes'

const exceptionFields: AssetOperationField[] = [
  { name: 'error.code', type: 'string', required: true, description: '当前失败节点的稳定错误码。' },
  { name: 'error.message', type: 'string', required: true, description: '当前失败节点的错误说明。' },
]

export const workflowPreviousValueFields = (workflow: WorkflowDefinition, nodeId: string): AssetOperationField[] => {
  const visited = new Set<string>()
  const fieldsFor = (targetId: string): AssetOperationField[] => {
    if (visited.has(targetId)) return []
    visited.add(targetId)
    const edge = workflow.edges.find(edge => edge.target === targetId)
    let previous = workflow.nodes.find(node => node.id === edge?.source)
    const iterationChild = isWorkflowControlNode(previous) && edge?.sourceHandle === 'item'
    if (iterationChild) {
      const upstream = workflow.edges.find(connection => connection.target === previous?.id)
      if (upstream?.sourceHandle) return []
      previous = workflow.nodes.find(node => node.id === upstream?.source)
    }
    if (!isWorkflowOperationNode(previous)) return []
    const operation = findAssetOperation(previous.assetType, previous.operationId)
    if (!operation?.workflow.enabled) return []
    if (edge?.sourceHandle && !iterationChild) {
      if (!previous.exceptionPorts?.some(port => port.id === edge.sourceHandle)) return []
      return [
        ...fieldsFor(previous.id).filter(field => field.name !== 'error' && !field.name.startsWith('error.')),
        ...exceptionFields,
      ]
    }
    const fields = assetOperationOutputFields(operation.contract)
    return iterationChild && 'outputType' in operation.contract
      ? fields.map(field => ({ ...field, name: field.name.replace(/^0\./, '') })) : fields
  }
  return fieldsFor(nodeId)
}

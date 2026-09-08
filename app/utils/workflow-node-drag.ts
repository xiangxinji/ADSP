import { assetTypes } from '#shared/types/asset-operations'
import type { AssetType } from '#shared/types/asset-operations'
import type { WorkflowNodePosition } from '#shared/types/asdp'

export const workflowNodeDragMime = 'application/x-forgepilot-workflow-node'

export type WorkflowOperationSelection = {
  assetType: AssetType
  assetId: string
  operationId: string
}

export type WorkflowNodeDragData =
  | { type: 'async' }
  | { type: 'operation', selection: WorkflowOperationSelection }

export type WorkflowNodeDropData = WorkflowNodeDragData & { position: WorkflowNodePosition }

export const serializeWorkflowNodeDragData = (data: WorkflowNodeDragData) => JSON.stringify(data)

export const parseWorkflowNodeDragData = (value: string): WorkflowNodeDragData | null => {
  try {
    const data = JSON.parse(value) as Record<string, unknown>
    if (data.type === 'async') return { type: 'async' }
    if (data.type !== 'operation' || !data.selection || typeof data.selection !== 'object') return null
    const selection = data.selection as Record<string, unknown>
    if (typeof selection.assetType !== 'string' || !assetTypes.includes(selection.assetType as AssetType)
      || typeof selection.assetId !== 'string' || !selection.assetId
      || typeof selection.operationId !== 'string' || !selection.operationId) return null
    return {
      type: 'operation',
      selection: {
        assetType: selection.assetType as AssetType,
        assetId: selection.assetId,
        operationId: selection.operationId,
      },
    }
  } catch {
    return null
  }
}

export const hasWorkflowNodeDragData = (dataTransfer: DataTransfer | null) => Boolean(
  dataTransfer && Array.from(dataTransfer.types).includes(workflowNodeDragMime),
)

export const readWorkflowNodeDragData = (dataTransfer: DataTransfer | null) => dataTransfer
  ? parseWorkflowNodeDragData(dataTransfer.getData(workflowNodeDragMime))
  : null

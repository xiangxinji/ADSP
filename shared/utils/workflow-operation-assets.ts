import type { WorkflowOperationNode } from '../types/asdp'

export const workflowAssetSource = (node: Pick<WorkflowOperationNode, 'assetSource' | 'assetId'>) =>
  node.assetSource ?? (node.assetId ? 'fixed' : 'input')

export const workflowAssetInputName = (node: Pick<WorkflowOperationNode, 'assetType'>) => `${node.assetType}Id`

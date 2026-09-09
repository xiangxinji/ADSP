import { assetOperationConfig, isProjectAssetOperation } from '#shared/config/asset-operations'
import type { AssetType } from '#shared/types/asdp'

export const workflowOperationGroups = (search = '', assetType: AssetType | 'all' = 'all') => {
  const keywords = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return assetOperationConfig.modules.filter(module => assetType === 'all' || module.assetType === assetType).map(module => ({
    assetType: module.assetType,
    label: module.label,
    operations: module.operations.filter(operation => operation.workflow.enabled)
      .map(operation => ({
        ...operation, assetType: module.assetType, displayLabel: operation.label,
        label: isProjectAssetOperation(operation) ? operation.label : module.label + operation.label,
      }))
      .filter(operation => keywords.every(keyword =>
        `${module.label} ${operation.label} ${operation.id} ${operation.description}`.toLowerCase().includes(keyword))),
  })).filter(group => group.operations.length)
}

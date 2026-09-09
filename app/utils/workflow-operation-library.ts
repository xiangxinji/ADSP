import { assetOperationConfig, isProjectAssetOperation } from '#shared/config/asset-operations'

export const workflowOperationGroups = (search = '') => {
  const query = search.trim().toLowerCase()
  return assetOperationConfig.modules.map(module => ({
    assetType: module.assetType,
    label: module.label,
    operations: module.operations.filter(operation => operation.workflow.enabled)
      .map(operation => ({
        ...operation, assetType: module.assetType,
        label: isProjectAssetOperation(operation) ? operation.label : module.label + operation.label,
      }))
      .filter(operation => `${module.label} ${operation.label} ${operation.id} ${operation.description}`.toLowerCase().includes(query)),
  })).filter(group => group.operations.length)
}

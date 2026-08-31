export const missingAssetReferenceLabel = '资产不存在'

export const missingAssetReferenceMessage = (assetType: string, recordId: string) =>
  `引用的资产不存在：${assetType}：${recordId}`

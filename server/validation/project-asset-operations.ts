import { assetTypes, type AssetType } from '../../shared/types/asset-operations'
import { createAssetOperationError } from '../utils/asset-operation-error'

export const projectAssetOperationType = (value: string): AssetType => {
  if (!assetTypes.includes(value as AssetType)) {
    throw createAssetOperationError(404, 'asset.operation-not-found', '资产类型不存在。')
  }
  return value as AssetType
}

export const projectAssetOperationInput = (body: unknown) => {
  if (body === undefined) return
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) {
    throw createAssetOperationError(400, 'asset.invalid-input', '获取全部资产不接受输入参数。')
  }
}

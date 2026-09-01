import { executeAssetOperation } from '../../../../../services/asset-operations'
import { assetTypes, type AssetType } from '../../../../../../shared/types/asset-operations'
import { routeParameter } from '../../../../../utils/http-input'

export default defineEventHandler((event) => {
  const assetType = routeParameter(event, 'assetType')
  if (!assetTypes.includes(assetType as AssetType)) {
    throw createError({ statusCode: 404, statusMessage: '资产类型不存在' })
  }

  return executeAssetOperation(
    assetType as AssetType,
    routeParameter(event),
    routeParameter(event, 'operationId'),
  )
})

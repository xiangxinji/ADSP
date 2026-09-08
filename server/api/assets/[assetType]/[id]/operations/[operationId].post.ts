import { executeAssetOperation } from '../../../../../services/asset-operations'
import { assetOperationInput } from '../../../../../validation/asset-operation-input'
import { assetTypes, type AssetType } from '../../../../../../shared/types/asset-operations'
import { routeParameter } from '../../../../../utils/http-input'

export default defineEventHandler(async (event) => {
  const assetType = routeParameter(event, 'assetType')
  if (!assetTypes.includes(assetType as AssetType)) {
    throw createError({ statusCode: 404, statusMessage: '资产类型不存在' })
  }
  const operationId = routeParameter(event, 'operationId')
  const input = assetType === 'repository'
    ? assetOperationInput(operationId, (await readBody(event)) || {})
    : undefined

  return executeAssetOperation(
    assetType as AssetType,
    routeParameter(event),
    operationId,
    input,
  )
})

import { executeAssetOperation } from '../../../../../services/asset-operations'
import { repositoryWorktreePayload } from '../../../../../validation/repository-assets'
import { assetTypes, type AssetType } from '../../../../../../shared/types/asset-operations'
import { routeParameter } from '../../../../../utils/http-input'

export default defineEventHandler(async (event) => {
  const assetType = routeParameter(event, 'assetType')
  if (!assetTypes.includes(assetType as AssetType)) {
    throw createError({ statusCode: 404, statusMessage: '资产类型不存在' })
  }
  const operationId = routeParameter(event, 'operationId')
  const input = assetType === 'repository' && operationId === 'repository.create-worktree'
    ? repositoryWorktreePayload(await readBody(event))
    : undefined

  return executeAssetOperation(
    assetType as AssetType,
    routeParameter(event),
    operationId,
    input,
  )
})

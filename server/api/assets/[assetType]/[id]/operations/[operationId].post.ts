import { executeAssetOperation } from '../../../../../services/asset-operations'
import {
  repositoryCreateBranchPayload,
  repositoryCreateMergeRequestPayload,
  repositoryWorktreePayload,
} from '../../../../../validation/repository-assets'
import { assetTypes, type AssetType } from '../../../../../../shared/types/asset-operations'
import { routeParameter } from '../../../../../utils/http-input'

export default defineEventHandler(async (event) => {
  const assetType = routeParameter(event, 'assetType')
  if (!assetTypes.includes(assetType as AssetType)) {
    throw createError({ statusCode: 404, statusMessage: '资产类型不存在' })
  }
  const operationId = routeParameter(event, 'operationId')
  let input
  if (assetType === 'repository' && operationId === 'repository.create-worktree') {
    input = repositoryWorktreePayload((await readBody(event)) || {})
  }
  if (assetType === 'repository' && operationId === 'repository.create-branch') {
    input = repositoryCreateBranchPayload((await readBody(event)) || {})
  }
  if (assetType === 'repository' && operationId === 'repository.create-merge-request') {
    input = repositoryCreateMergeRequestPayload((await readBody(event)) || {})
  }

  return executeAssetOperation(
    assetType as AssetType,
    routeParameter(event),
    operationId,
    input,
  )
})

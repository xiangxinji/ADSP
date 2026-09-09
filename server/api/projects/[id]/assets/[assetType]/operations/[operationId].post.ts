import { executeProjectAssetOperation } from '../../../../../../services/project-asset-operations'
import { routeParameter } from '../../../../../../utils/http-input'
import { projectAssetOperationInput, projectAssetOperationType } from '../../../../../../validation/project-asset-operations'

export default defineEventHandler(async (event) => {
  const assetType = projectAssetOperationType(routeParameter(event, 'assetType'))
  const input = await readBody(event)
  projectAssetOperationInput(input)
  return executeProjectAssetOperation(routeParameter(event), assetType, routeParameter(event, 'operationId'), input)
})

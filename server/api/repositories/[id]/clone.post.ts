import { executeRepositoryCloneOperation } from '../../../services/asset-operations'
import { routeParameter } from '../../../utils/http-input'

export default defineEventHandler(async (event) => {
  const result = await executeRepositoryCloneOperation(routeParameter(event))
  setResponseStatus(event, 201)
  return result
})

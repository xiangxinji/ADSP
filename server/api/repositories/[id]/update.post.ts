import { executeRepositoryUpdateOperation } from '../../../services/asset-operations'
import { routeParameter } from '../../../utils/http-input'

export default defineEventHandler(event => executeRepositoryUpdateOperation(routeParameter(event)))

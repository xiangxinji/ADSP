import { updateRepositoryWorkingCopy } from '../../../services/repository-cloning'
import { routeParameter } from '../../../utils/http-input'

export default defineEventHandler(event => updateRepositoryWorkingCopy(routeParameter(event)))

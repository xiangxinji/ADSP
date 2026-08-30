import { getProjectWorkspace } from '../../services/project-workspace'
import { routeParameter } from '../../utils/http-input'

export default defineEventHandler(event => getProjectWorkspace(routeParameter(event)))

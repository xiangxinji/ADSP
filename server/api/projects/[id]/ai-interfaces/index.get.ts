import { listProjectAiInterfaces } from '../../../../services/ai-interface-assets'
import { routeParameter } from '../../../../utils/http-input'

export default defineEventHandler(event => listProjectAiInterfaces(routeParameter(event)))

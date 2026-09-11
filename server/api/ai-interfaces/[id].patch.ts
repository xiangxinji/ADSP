import { updateAiInterface } from '../../services/ai-interface-assets'
import { routeParameter } from '../../utils/http-input'
import { aiInterfacePayload } from '../../validation/ai-interface-assets'

export default defineEventHandler(async event => updateAiInterface(
  routeParameter(event),
  aiInterfacePayload(await readBody(event), true),
))

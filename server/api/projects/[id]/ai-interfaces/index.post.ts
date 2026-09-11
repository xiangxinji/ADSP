import { createAiInterface } from '../../../../services/ai-interface-assets'
import { routeParameter } from '../../../../utils/http-input'
import { aiInterfacePayload } from '../../../../validation/ai-interface-assets'

export default defineEventHandler(async (event) => {
  const asset = createAiInterface(routeParameter(event), aiInterfacePayload(await readBody(event)))
  setResponseStatus(event, 201)
  return asset
})

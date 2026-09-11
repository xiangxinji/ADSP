import { deleteAiInterface } from '../../services/ai-interface-assets'
import { routeParameter } from '../../utils/http-input'

export default defineEventHandler((event) => {
  deleteAiInterface(routeParameter(event))
  setResponseStatus(event, 204)
  return null
})

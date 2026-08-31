import { deleteKnowledge } from '../../services/knowledge-assets'
import { routeParameter } from '../../utils/http-input'

export default defineEventHandler((event) => {
  deleteKnowledge(routeParameter(event))
  setResponseStatus(event, 204)
  return null
})

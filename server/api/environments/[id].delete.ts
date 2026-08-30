import { deleteEnvironment } from '../../services/environment-assets'
import { routeParameter } from '../../utils/http-input'

export default defineEventHandler((event) => {
  deleteEnvironment(routeParameter(event))
  setResponseStatus(event, 204)
  return null
})

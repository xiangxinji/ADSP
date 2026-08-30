import { deleteRequirement } from '../../services/requirements'
import { routeParameter } from '../../utils/http-input'

export default defineEventHandler((event) => {
  deleteRequirement(routeParameter(event))
  setResponseStatus(event, 204)
  return null
})

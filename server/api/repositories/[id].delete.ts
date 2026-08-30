import { deleteRepository } from '../../services/repository-assets'
import { routeParameter } from '../../utils/http-input'

export default defineEventHandler((event) => {
  deleteRepository(routeParameter(event))
  setResponseStatus(event, 204)
  return null
})

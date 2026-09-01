import { cloneRepository } from '../../../services/repository-cloning'
import { routeParameter } from '../../../utils/http-input'

export default defineEventHandler(async (event) => {
  const result = await cloneRepository(routeParameter(event))
  setResponseStatus(event, 201)
  return result
})

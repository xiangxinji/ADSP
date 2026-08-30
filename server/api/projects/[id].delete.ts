import { deleteProject } from '../../services/projects'
import { routeParameter } from '../../utils/http-input'

export default defineEventHandler((event) => {
  deleteProject(routeParameter(event))
  setResponseStatus(event, 204)
  return null
})

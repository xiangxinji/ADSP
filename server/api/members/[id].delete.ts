import { deleteProjectMember } from '../../services/project-members'
import { routeParameter } from '../../utils/http-input'

export default defineEventHandler((event) => {
  deleteProjectMember(routeParameter(event))
  setResponseStatus(event, 204)
  return null
})

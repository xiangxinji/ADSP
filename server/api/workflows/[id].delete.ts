import { deleteWorkflow } from '../../services/workflow-definitions'
import { routeParameter } from '../../utils/http-input'

export default defineEventHandler((event) => {
  deleteWorkflow(routeParameter(event))
  setResponseStatus(event, 204)
  return null
})

import { deleteRequirementStatus } from '../../services/requirement-statuses'
import { routeParameter } from '../../utils/http-input'

export default defineEventHandler((event) => {
  deleteRequirementStatus(routeParameter(event))
  setResponseStatus(event, 204)
})

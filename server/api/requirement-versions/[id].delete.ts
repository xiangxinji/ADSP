import { deleteRequirementVersion } from '../../services/requirement-versions'
import { routeParameter } from '../../utils/http-input'

export default defineEventHandler((event) => {
  deleteRequirementVersion(routeParameter(event))
  setResponseStatus(event, 204)
})

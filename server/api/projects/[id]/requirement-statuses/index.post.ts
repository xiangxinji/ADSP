import type { CreateRequirementStatusInput } from '../../../../../shared/types/asdp'
import { createRequirementStatus } from '../../../../services/requirement-statuses'
import { routeParameter } from '../../../../utils/http-input'
import { requirementStatusPayload } from '../../../../validation/requirement-statuses'

export default defineEventHandler(async (event) => {
  const status = createRequirementStatus(
    routeParameter(event),
    requirementStatusPayload(await readBody(event)) as CreateRequirementStatusInput,
  )
  setResponseStatus(event, 201)
  return status
})

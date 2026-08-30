import type { CreateRequirementInput } from '../../../../../shared/types/asdp'
import { createRequirement } from '../../../../services/requirements'
import { routeParameter } from '../../../../utils/http-input'
import { requirementPayload } from '../../../../validation/requirements'

export default defineEventHandler(async (event) => {
  const requirement = createRequirement(
    routeParameter(event),
    requirementPayload(await readBody(event)) as CreateRequirementInput,
  )
  setResponseStatus(event, 201)
  return requirement
})

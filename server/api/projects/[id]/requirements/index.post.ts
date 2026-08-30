import type { CreateRequirementInput } from '../../../../../shared/types/asdp'
import { createRequirement } from '../../../../utils/asdp-store'
import { requirementPayload } from '../../../../utils/payloads'

export default defineEventHandler(async (event) => {
  const requirement = createRequirement(
    getRouterParam(event, 'id') || '',
    requirementPayload(await readBody(event)) as CreateRequirementInput,
  )
  setResponseStatus(event, 201)
  return requirement
})

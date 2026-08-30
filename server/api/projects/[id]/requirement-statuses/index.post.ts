import type { CreateRequirementStatusInput } from '../../../../../shared/types/asdp'
import { createRequirementStatus } from '../../../../utils/asdp-store'
import { requirementStatusPayload } from '../../../../utils/payloads'

export default defineEventHandler(async (event) => {
  const status = createRequirementStatus(
    getRouterParam(event, 'id') || '',
    requirementStatusPayload(await readBody(event)) as CreateRequirementStatusInput,
  )
  setResponseStatus(event, 201)
  return status
})

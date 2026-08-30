import type { UpdateRequirementStatusInput } from '../../../shared/types/asdp'
import { updateRequirementStatus } from '../../utils/asdp-store'
import { requirementStatusPayload } from '../../utils/payloads'

export default defineEventHandler(async event => updateRequirementStatus(
  getRouterParam(event, 'id') || '',
  requirementStatusPayload(await readBody(event), true) as UpdateRequirementStatusInput,
))

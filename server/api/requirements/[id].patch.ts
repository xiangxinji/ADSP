import type { UpdateRequirementInput } from '../../../shared/types/asdp'
import { updateRequirement } from '../../utils/asdp-store'
import { requirementPayload } from '../../utils/payloads'

export default defineEventHandler(async (event) => updateRequirement(
  getRouterParam(event, 'id') || '',
  requirementPayload(await readBody(event), true) as UpdateRequirementInput,
))

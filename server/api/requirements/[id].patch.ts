import type { UpdateRequirementInput } from '../../../shared/types/asdp'
import { updateRequirement } from '../../services/requirements'
import { routeParameter } from '../../utils/http-input'
import { requirementPayload } from '../../validation/requirements'

export default defineEventHandler(async (event) => updateRequirement(
  routeParameter(event),
  requirementPayload(await readBody(event), true) as UpdateRequirementInput,
))

import type { UpdateRequirementStatusInput } from '../../../shared/types/asdp'
import { updateRequirementStatus } from '../../services/requirement-statuses'
import { routeParameter } from '../../utils/http-input'
import { requirementStatusPayload } from '../../validation/requirement-statuses'

export default defineEventHandler(async event => updateRequirementStatus(
  routeParameter(event),
  requirementStatusPayload(await readBody(event), true) as UpdateRequirementStatusInput,
))

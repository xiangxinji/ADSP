import type { UpdateRequirementVersionInput } from '../../../shared/types/asdp'
import { updateRequirementVersion } from '../../services/requirement-versions'
import { routeParameter } from '../../utils/http-input'
import { requirementVersionPayload } from '../../validation/requirement-versions'

export default defineEventHandler(async event => updateRequirementVersion(
  routeParameter(event),
  requirementVersionPayload(await readBody(event), true) as UpdateRequirementVersionInput,
))

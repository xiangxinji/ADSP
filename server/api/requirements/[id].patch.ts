import type { UpdateRequirementInput } from '../../../shared/types/asdp'
import { updateRequirementAndQueueWorkflows } from '../../services/requirement-update-orchestration'
import { routeParameter } from '../../utils/http-input'
import { requirementPayload } from '../../validation/requirements'

export default defineEventHandler(async (event) => {
  const { requirement, completion } = updateRequirementAndQueueWorkflows(
    routeParameter(event),
    requirementPayload(await readBody(event), true) as UpdateRequirementInput,
  )
  event.waitUntil(completion)
  return requirement
})

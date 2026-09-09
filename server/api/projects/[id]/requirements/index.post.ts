import type { CreateRequirementInput } from '../../../../../shared/types/asdp'
import { createRequirementAndQueueWorkflows } from '../../../../services/requirement-creation-orchestration'
import { routeParameter } from '../../../../utils/http-input'
import { requirementPayload } from '../../../../validation/requirements'

export default defineEventHandler(async (event) => {
  const { requirement, completion } = createRequirementAndQueueWorkflows(
    routeParameter(event),
    requirementPayload(await readBody(event)) as CreateRequirementInput,
  )
  event.waitUntil(completion)
  setResponseStatus(event, 201)
  return requirement
})

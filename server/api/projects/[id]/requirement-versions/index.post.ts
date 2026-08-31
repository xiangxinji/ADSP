import type { CreateRequirementVersionInput } from '../../../../../shared/types/asdp'
import { createRequirementVersion } from '../../../../services/requirement-versions'
import { routeParameter } from '../../../../utils/http-input'
import { requirementVersionPayload } from '../../../../validation/requirement-versions'

export default defineEventHandler(async (event) => {
  const version = createRequirementVersion(
    routeParameter(event),
    requirementVersionPayload(await readBody(event)) as CreateRequirementVersionInput,
  )
  setResponseStatus(event, 201)
  return version
})

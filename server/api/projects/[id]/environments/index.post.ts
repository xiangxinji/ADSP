import type { CreateEnvironmentInput } from '../../../../../shared/types/asdp'
import { createEnvironment } from '../../../../services/environment-assets'
import { routeParameter } from '../../../../utils/http-input'
import { environmentPayload } from '../../../../validation/environment-assets'

export default defineEventHandler(async (event) => {
  const environment = createEnvironment(
    routeParameter(event),
    environmentPayload(await readBody(event)) as CreateEnvironmentInput,
  )
  setResponseStatus(event, 201)
  return environment
})

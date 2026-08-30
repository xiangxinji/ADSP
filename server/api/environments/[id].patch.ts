import type { UpdateEnvironmentInput } from '../../../shared/types/asdp'
import { updateEnvironment } from '../../services/environment-assets'
import { routeParameter } from '../../utils/http-input'
import { environmentPayload } from '../../validation/environment-assets'

export default defineEventHandler(async event => updateEnvironment(
  routeParameter(event),
  environmentPayload(await readBody(event), true) as UpdateEnvironmentInput,
))

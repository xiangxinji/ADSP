import type { UpdateRepositoryInput } from '../../../shared/types/asdp'
import { updateRepository } from '../../services/repository-assets'
import { routeParameter } from '../../utils/http-input'
import { repositoryPayload } from '../../validation/repository-assets'

export default defineEventHandler(async (event) => updateRepository(
  routeParameter(event),
  repositoryPayload(await readBody(event), true) as UpdateRepositoryInput,
))

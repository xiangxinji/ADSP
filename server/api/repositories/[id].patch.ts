import type { UpdateRepositoryInput } from '../../../shared/types/asdp'
import { updateRepository } from '../../utils/asdp-store'
import { repositoryPayload } from '../../utils/payloads'

export default defineEventHandler(async (event) => updateRepository(
  getRouterParam(event, 'id') || '',
  repositoryPayload(await readBody(event), true) as UpdateRepositoryInput,
))

import type { CreateRepositoryInput } from '../../../../../shared/types/asdp'
import { createRepository } from '../../../../utils/asdp-store'
import { repositoryPayload } from '../../../../utils/payloads'

export default defineEventHandler(async (event) => {
  const repository = createRepository(
    getRouterParam(event, 'id') || '',
    repositoryPayload(await readBody(event)) as CreateRepositoryInput,
  )
  setResponseStatus(event, 201)
  return repository
})

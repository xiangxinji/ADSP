import type { CreateRepositoryInput } from '../../../../../shared/types/asdp'
import { createRepository } from '../../../../services/repository-assets'
import { routeParameter } from '../../../../utils/http-input'
import { repositoryPayload } from '../../../../validation/repository-assets'

export default defineEventHandler(async (event) => {
  const repository = createRepository(
    routeParameter(event),
    repositoryPayload(await readBody(event)) as CreateRepositoryInput,
  )
  setResponseStatus(event, 201)
  return repository
})

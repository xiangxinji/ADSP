import type { CreatePersonInput } from '../../../../../shared/types/asdp'
import { createPerson } from '../../../../utils/asdp-store'
import { personPayload } from '../../../../utils/payloads'

export default defineEventHandler(async (event) => {
  const person = createPerson(
    getRouterParam(event, 'id') || '',
    personPayload(await readBody(event)) as CreatePersonInput,
  )
  setResponseStatus(event, 201)
  return person
})

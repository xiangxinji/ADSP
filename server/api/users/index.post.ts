import { createUser } from '../../utils/asdp-store'
import { userPayload } from '../../utils/payloads'

export default defineEventHandler(async (event) => {
  const user = createUser(userPayload(await readBody(event)))
  setResponseStatus(event, 201)
  return user
})

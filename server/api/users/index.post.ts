import { createUser } from '../../services/users'
import { userPayload } from '../../validation/users'

export default defineEventHandler(async (event) => {
  const user = await createUser(userPayload(await readBody(event)))
  setResponseStatus(event, 201)
  return user
})

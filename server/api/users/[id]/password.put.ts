import { updateUserPassword } from '../../../services/users'
import { userPasswordPayload } from '../../../validation/users'
import { routeParameter } from '../../../utils/http-input'

export default defineEventHandler(async (event) => {
  const { password } = userPasswordPayload(await readBody(event))
  return updateUserPassword(routeParameter(event), password)
})

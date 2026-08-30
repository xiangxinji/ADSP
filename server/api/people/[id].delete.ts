import { deletePerson } from '../../utils/asdp-store'

export default defineEventHandler((event) => {
  deletePerson(getRouterParam(event, 'id') || '')
  setResponseStatus(event, 204)
  return null
})

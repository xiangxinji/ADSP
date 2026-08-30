import { deleteRepository } from '../../utils/asdp-store'

export default defineEventHandler((event) => {
  deleteRepository(getRouterParam(event, 'id') || '')
  setResponseStatus(event, 204)
  return null
})

import { deleteRequirement } from '../../utils/asdp-store'

export default defineEventHandler((event) => {
  deleteRequirement(getRouterParam(event, 'id') || '')
  setResponseStatus(event, 204)
  return null
})

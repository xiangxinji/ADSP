import { deleteProjectMember } from '../../utils/asdp-store'

export default defineEventHandler((event) => {
  deleteProjectMember(getRouterParam(event, 'id') || '')
  setResponseStatus(event, 204)
  return null
})

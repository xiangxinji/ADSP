import { deleteProject } from '../../utils/asdp-store'

export default defineEventHandler((event) => {
  deleteProject(getRouterParam(event, 'id') || '')
  setResponseStatus(event, 204)
  return null
})

import { deleteRequirementStatus } from '../../utils/asdp-store'

export default defineEventHandler((event) => {
  deleteRequirementStatus(getRouterParam(event, 'id') || '')
  setResponseStatus(event, 204)
})

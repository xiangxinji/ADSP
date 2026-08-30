import { getProjectWorkspace } from '../../utils/asdp-store'

export default defineEventHandler(event => getProjectWorkspace(getRouterParam(event, 'id') || ''))

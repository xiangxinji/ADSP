import type { UpdateProjectInput } from '../../../shared/types/asdp'
import { updateProject } from '../../utils/asdp-store'
import { projectPayload } from '../../utils/payloads'

export default defineEventHandler(async (event) => updateProject(
  getRouterParam(event, 'id') || '',
  projectPayload(await readBody(event), true) as UpdateProjectInput,
))

import type { UpdateProjectMemberInput } from '../../../shared/types/asdp'
import { updateProjectMember } from '../../utils/asdp-store'
import { projectMemberPayload } from '../../utils/payloads'

export default defineEventHandler(async (event) => updateProjectMember(
  getRouterParam(event, 'id') || '',
  projectMemberPayload(await readBody(event), true) as UpdateProjectMemberInput,
))

import type { UpdateProjectMemberInput } from '../../../shared/types/asdp'
import { updateProjectMember } from '../../services/project-members'
import { routeParameter } from '../../utils/http-input'
import { projectMemberPayload } from '../../validation/project-members'

export default defineEventHandler(async (event) => updateProjectMember(
  routeParameter(event),
  projectMemberPayload(await readBody(event), true) as UpdateProjectMemberInput,
))

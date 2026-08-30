import type { CreateProjectMemberInput } from '../../../../../shared/types/asdp'
import { createProjectMember } from '../../../../services/project-members'
import { routeParameter } from '../../../../utils/http-input'
import { projectMemberPayload } from '../../../../validation/project-members'

export default defineEventHandler(async (event) => {
  const member = createProjectMember(
    routeParameter(event),
    projectMemberPayload(await readBody(event)) as CreateProjectMemberInput,
  )
  setResponseStatus(event, 201)
  return member
})

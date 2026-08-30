import type { CreateProjectMemberInput } from '../../../../../shared/types/asdp'
import { createProjectMember } from '../../../../utils/asdp-store'
import { projectMemberPayload } from '../../../../utils/payloads'

export default defineEventHandler(async (event) => {
  const member = createProjectMember(
    getRouterParam(event, 'id') || '',
    projectMemberPayload(await readBody(event)) as CreateProjectMemberInput,
  )
  setResponseStatus(event, 201)
  return member
})

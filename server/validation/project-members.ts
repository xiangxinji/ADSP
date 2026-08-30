import type { CreateProjectMemberInput, UpdateProjectMemberInput } from '../../shared/types/asdp'
import { bodyObject, requiredText } from '../utils/http-input'

export const projectMemberPayload = (
  value: unknown,
  partial = false,
): CreateProjectMemberInput | UpdateProjectMemberInput => {
  const body = bodyObject(value)
  const role = requiredText(body.role, 'role')
  if (partial) return { role }
  return { userId: requiredText(body.userId, 'userId'), role }
}

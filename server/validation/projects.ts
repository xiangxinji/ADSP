import type { CreateProjectInput, UpdateProjectInput } from '../../shared/types/asdp'
import { bodyObject, optionalText, requiredText } from '../utils/http-input'

export const projectPayload = (value: unknown, partial = false): CreateProjectInput | UpdateProjectInput => {
  const body = bodyObject(value)
  return {
    name: partial && body.name === undefined ? undefined : requiredText(body.name, 'name'),
    description: partial && body.description === undefined ? undefined : optionalText(body.description),
  }
}

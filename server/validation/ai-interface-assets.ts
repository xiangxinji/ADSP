import { createError } from 'h3'
import type { CreateAiInterfaceInput, UpdateAiInterfaceInput } from '../../shared/types/ai-interfaces'
import { bodyObject, requiredText } from '../utils/http-input'

const aiInterfaceText = (value: unknown, field: string, limit: number) => {
  const text = requiredText(value, field)
  if (text.length > limit || /[\u0000-\u001f\u007f]/.test(text)) {
    throw createError({ statusCode: 400, statusMessage: `${field} must be ${limit} characters or fewer without control characters` })
  }
  return text
}

export function aiInterfacePayload(value: unknown): CreateAiInterfaceInput
export function aiInterfacePayload(value: unknown, partial: true): UpdateAiInterfaceInput
export function aiInterfacePayload(value: unknown, partial = false): CreateAiInterfaceInput | UpdateAiInterfaceInput {
  const body = bodyObject(value)
  if (Object.keys(body).some(key => !['provider', 'name', 'apiKey'].includes(key))) {
    throw createError({ statusCode: 400, statusMessage: 'Only provider, name and apiKey can be supplied' })
  }
  return {
    provider: partial && body.provider === undefined ? undefined : aiInterfaceText(body.provider, 'provider', 100),
    name: partial && body.name === undefined ? undefined : aiInterfaceText(body.name, 'name', 100),
    apiKey: partial && body.apiKey === undefined ? undefined : aiInterfaceText(body.apiKey, 'apiKey', 4096),
  }
}

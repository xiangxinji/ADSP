import { bodyObject, optionalText } from '../utils/http-input'

export const gitLabSettingsPayload = (value: unknown): { baseUrl?: string, token?: string } => {
  const body = bodyObject(value)
  return {
    baseUrl: body.baseUrl === undefined ? undefined : optionalText(body.baseUrl),
    token: body.token === undefined ? undefined : optionalText(body.token),
  }
}

import { createError } from 'h3'
import { bodyObject, requiredText } from '../utils/http-input'

export const localWorkspaceSettingsPayload = (value: unknown): { path: string } => {
  const body = bodyObject(value)
  const path = requiredText(body.path, '工作空间路径')
  if (path.length > 4096) {
    throw createError({ statusCode: 400, statusMessage: '工作空间路径不能超过 4096 个字符' })
  }
  return { path }
}

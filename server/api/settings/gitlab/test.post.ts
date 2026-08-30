import { createError } from 'h3'
import { normalizeGitLabBaseUrl, verifyGitLabConnection } from '../../../utils/gitlab-adapter'
import { bodyObject, optionalText } from '../../../utils/http-input'
import { getGitLabCredentials, getGitLabSettings } from '../../../utils/integration-settings'

export default defineEventHandler(async (event) => {
  const body = bodyObject(await readBody(event))
  const suppliedToken = optionalText(body.token)
  const currentSettings = getGitLabSettings()
  const currentCredentials = suppliedToken ? null : getGitLabCredentials()
  const baseUrl = normalizeGitLabBaseUrl(optionalText(body.baseUrl, currentSettings.baseUrl))
  const token = suppliedToken || currentCredentials?.token
  if (!token) throw createError({ statusCode: 400, statusMessage: '请先输入 GitLab Access Token' })
  return verifyGitLabConnection({ baseUrl, token })
})

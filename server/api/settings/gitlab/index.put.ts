import { createError } from 'h3'
import { normalizeGitLabBaseUrl, verifyGitLabConnection } from '../../../utils/gitlab-adapter'
import { bodyObject, optionalText } from '../../../utils/http-input'
import { getGitLabCredentials, getGitLabSettings, saveGitLabSettings } from '../../../utils/integration-settings'

export default defineEventHandler(async (event) => {
  const body = bodyObject(await readBody(event))
  const suppliedToken = optionalText(body.token)
  const currentSettings = getGitLabSettings()
  const currentCredentials = suppliedToken ? null : getGitLabCredentials()
  const baseUrl = normalizeGitLabBaseUrl(optionalText(body.baseUrl, currentSettings.baseUrl))
  const token = suppliedToken || currentCredentials?.token
  if (!token) throw createError({ statusCode: 400, statusMessage: 'GitLab Access Token 是必填项' })

  const credentials = { baseUrl, token }
  const identity = await verifyGitLabConnection(credentials)
  return saveGitLabSettings(credentials, identity)
})

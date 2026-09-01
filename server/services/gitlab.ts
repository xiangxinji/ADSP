import { createError } from 'h3'
import type { GitLabIdentity, GitLabSettings } from '../../shared/types/asdp'
import {
  listGitLabRepositories as listRepositoriesFromGitLab,
  normalizeGitLabBaseUrl,
  verifyGitLabConnection,
  type GitLabCredentials,
} from '../integrations/gitlab'
import {
  findGitLabSettingsRecord,
  removeGitLabSettingsRecord,
  upsertGitLabSettingsRecord,
} from '../repositories/gitlab-settings'
import { decryptCredential, encryptCredential } from '../utils/credentials'

export type GitLabSettingsInput = {
  baseUrl?: string
  token?: string
}

const settingsFromRecord = (): GitLabSettings => {
  const record = findGitLabSettingsRecord()
  if (!record) {
    return {
      baseUrl: 'https://gitlab.com',
      configured: false,
      tokenHint: '',
      connectedUser: null,
      verifiedAt: null,
      updatedAt: null,
    }
  }
  const connectedUser = record.connectedUserId === null || !record.connectedUsername
    ? null
    : {
        id: Number(record.connectedUserId),
        name: record.connectedUserName || record.connectedUsername,
        username: record.connectedUsername,
      }
  return {
    baseUrl: record.baseUrl,
    configured: true,
    tokenHint: record.tokenHint,
    connectedUser,
    verifiedAt: record.verifiedAt,
    updatedAt: record.updatedAt,
  }
}

const getStoredCredentials = (): GitLabCredentials | null => {
  const record = findGitLabSettingsRecord()
  if (!record) return null
  try {
    return { baseUrl: record.baseUrl, token: decryptCredential(record.encryptedToken) }
  } catch {
    throw createError({ statusCode: 500, statusMessage: '保存的 GitLab 凭据无法解密，请移除配置后重新保存' })
  }
}

export const getStoredGitLabCredentials = () => getStoredCredentials()

const resolveCredentials = (input: GitLabSettingsInput, missingTokenMessage: string) => {
  const suppliedToken = input.token?.trim() || ''
  const currentSettings = settingsFromRecord()
  const currentCredentials = suppliedToken ? null : getStoredCredentials()
  const baseUrl = normalizeGitLabBaseUrl(
    input.baseUrl === undefined ? currentSettings.baseUrl : input.baseUrl.trim(),
  )
  const token = suppliedToken || currentCredentials?.token
  if (!token) throw createError({ statusCode: 400, statusMessage: missingTokenMessage })
  return { baseUrl, token }
}

const saveSettings = (credentials: GitLabCredentials, identity: GitLabIdentity) => {
  const timestamp = new Date().toISOString()
  const existing = findGitLabSettingsRecord()
  upsertGitLabSettingsRecord({
    baseUrl: credentials.baseUrl,
    encryptedToken: encryptCredential(credentials.token),
    tokenHint: credentials.token.length > 4 ? `••••${credentials.token.slice(-4)}` : '••••',
    connectedUserId: identity.id,
    connectedUserName: identity.name,
    connectedUsername: identity.username,
    verifiedAt: timestamp,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  })
  return settingsFromRecord()
}

export const getGitLabSettings = () => settingsFromRecord()

export const updateGitLabSettings = async (input: GitLabSettingsInput) => {
  const credentials = resolveCredentials(input, 'GitLab Access Token 是必填项')
  const identity = await verifyGitLabConnection(credentials)
  return saveSettings(credentials, identity)
}

export const testGitLabSettings = (input: GitLabSettingsInput) => verifyGitLabConnection(
  resolveCredentials(input, '请先输入 GitLab Access Token'),
)

export const deleteGitLabSettings = () => removeGitLabSettingsRecord()

export const listAvailableGitLabRepositories = (
  options: { search?: string, page: number, perPage: number },
) => {
  const credentials = getStoredCredentials()
  if (!credentials) {
    throw createError({ statusCode: 409, statusMessage: '请先在全局设置中配置 GitLab' })
  }
  return listRepositoriesFromGitLab(credentials, options)
}

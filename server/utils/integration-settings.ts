import { createError } from 'h3'
import type { GitLabIdentity, GitLabSettings } from '../../shared/types/asdp'
import { decryptCredential, encryptCredential } from './credentials'
import { useDatabase } from './database'

type GitLabSettingsRow = {
  base_url: string
  encrypted_token: string
  token_hint: string
  connected_user_id: number | null
  connected_user_name: string | null
  connected_username: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export type GitLabCredentials = {
  baseUrl: string
  token: string
}

const getRow = () => useDatabase().prepare(`
  SELECT base_url, encrypted_token, token_hint, connected_user_id,
    connected_user_name, connected_username, verified_at, created_at, updated_at
  FROM integration_settings WHERE provider = 'gitlab'
`).get() as GitLabSettingsRow | undefined

const connectedUserFromRow = (row: GitLabSettingsRow): GitLabIdentity | null => {
  if (row.connected_user_id === null || !row.connected_username) return null
  return {
    id: Number(row.connected_user_id),
    name: row.connected_user_name || row.connected_username,
    username: row.connected_username,
  }
}

export const getGitLabSettings = (): GitLabSettings => {
  const row = getRow()
  if (!row) {
    return {
      baseUrl: 'https://gitlab.com',
      configured: false,
      tokenHint: '',
      connectedUser: null,
      verifiedAt: null,
      updatedAt: null,
    }
  }

  return {
    baseUrl: row.base_url,
    configured: true,
    tokenHint: row.token_hint,
    connectedUser: connectedUserFromRow(row),
    verifiedAt: row.verified_at,
    updatedAt: row.updated_at,
  }
}

export const getGitLabCredentials = (): GitLabCredentials | null => {
  const row = getRow()
  if (!row) return null
  try {
    return { baseUrl: row.base_url, token: decryptCredential(row.encrypted_token) }
  } catch {
    throw createError({ statusCode: 500, statusMessage: '保存的 GitLab 凭据无法解密，请移除配置后重新保存' })
  }
}

export const saveGitLabSettings = (credentials: GitLabCredentials, identity: GitLabIdentity): GitLabSettings => {
  const timestamp = new Date().toISOString()
  const existing = getRow()
  const tokenHint = credentials.token.length > 4 ? `••••${credentials.token.slice(-4)}` : '••••'
  useDatabase().prepare(`
    INSERT INTO integration_settings (
      provider, base_url, encrypted_token, token_hint, connected_user_id,
      connected_user_name, connected_username, verified_at, created_at, updated_at
    ) VALUES ('gitlab', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      base_url = excluded.base_url,
      encrypted_token = excluded.encrypted_token,
      token_hint = excluded.token_hint,
      connected_user_id = excluded.connected_user_id,
      connected_user_name = excluded.connected_user_name,
      connected_username = excluded.connected_username,
      verified_at = excluded.verified_at,
      updated_at = excluded.updated_at
  `).run(
    credentials.baseUrl,
    encryptCredential(credentials.token),
    tokenHint,
    identity.id,
    identity.name,
    identity.username,
    timestamp,
    existing?.created_at || timestamp,
    timestamp,
  )
  return getGitLabSettings()
}

export const deleteGitLabSettings = () => {
  useDatabase().prepare("DELETE FROM integration_settings WHERE provider = 'gitlab'").run()
}

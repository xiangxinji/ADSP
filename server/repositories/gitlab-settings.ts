import { useDatabase } from '../utils/database'

export type GitLabSettingsRecord = {
  baseUrl: string
  encryptedToken: string
  tokenHint: string
  connectedUserId: number | null
  connectedUserName: string | null
  connectedUsername: string | null
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
}

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

export const findGitLabSettingsRecord = () => {
  const row = useDatabase().prepare(`
    SELECT base_url, encrypted_token, token_hint, connected_user_id,
      connected_user_name, connected_username, verified_at, created_at, updated_at
    FROM integration_settings WHERE provider = 'gitlab'
  `).get() as GitLabSettingsRow | undefined
  if (!row) return undefined
  return {
    baseUrl: row.base_url,
    encryptedToken: row.encrypted_token,
    tokenHint: row.token_hint,
    connectedUserId: row.connected_user_id,
    connectedUserName: row.connected_user_name,
    connectedUsername: row.connected_username,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies GitLabSettingsRecord
}

export const upsertGitLabSettingsRecord = (settings: GitLabSettingsRecord) => {
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
    settings.baseUrl,
    settings.encryptedToken,
    settings.tokenHint,
    settings.connectedUserId,
    settings.connectedUserName,
    settings.connectedUsername,
    settings.verifiedAt,
    settings.createdAt,
    settings.updatedAt,
  )
}

export const removeGitLabSettingsRecord = () => {
  useDatabase().prepare("DELETE FROM integration_settings WHERE provider = 'gitlab'").run()
}

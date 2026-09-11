import type { AiInterfaceRecord } from '../domain/ai-interfaces'
import { useDatabase } from '../utils/database'

type AiInterfaceRow = {
  id: string
  project_id: string
  provider: string
  name: string
  encrypted_api_key: string
  created_at: string
  updated_at: string
}

const aiInterfaceFromRow = (row: AiInterfaceRow): AiInterfaceRecord => ({
  id: row.id,
  projectId: row.project_id,
  provider: row.provider,
  name: row.name,
  encryptedApiKey: row.encrypted_api_key,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const findAiInterfaceAsset = (id: string) => {
  const row = useDatabase().prepare('SELECT * FROM ai_interface_assets WHERE id = ?')
    .get(id) as AiInterfaceRow | undefined
  return row ? aiInterfaceFromRow(row) : undefined
}

export const listAiInterfaceAssets = (projectId: string) => (useDatabase().prepare(`
  SELECT * FROM ai_interface_assets WHERE project_id = ? ORDER BY updated_at DESC
`).all(projectId) as AiInterfaceRow[]).map(aiInterfaceFromRow)

export const insertAiInterfaceAsset = (asset: AiInterfaceRecord) => {
  useDatabase().prepare(`
    INSERT INTO ai_interface_assets
      (id, project_id, provider, name, encrypted_api_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(asset.id, asset.projectId, asset.provider, asset.name, asset.encryptedApiKey, asset.createdAt, asset.updatedAt)
}

export const updateAiInterfaceAssetRecord = (asset: AiInterfaceRecord) => {
  useDatabase().prepare(`
    UPDATE ai_interface_assets SET provider = ?, name = ?, encrypted_api_key = ?, updated_at = ? WHERE id = ?
  `).run(asset.provider, asset.name, asset.encryptedApiKey, asset.updatedAt, asset.id)
}

export const removeAiInterfaceAsset = (id: string) => {
  useDatabase().prepare('DELETE FROM ai_interface_assets WHERE id = ?').run(id)
}

export const removeProjectAiInterfaceAssets = (projectId: string) => {
  useDatabase().prepare('DELETE FROM ai_interface_assets WHERE project_id = ?').run(projectId)
}

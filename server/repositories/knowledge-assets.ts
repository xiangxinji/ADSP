import type { KnowledgeAsset } from '../../shared/types/asdp'
import { useDatabase } from '../utils/database'

export type KnowledgeAssetRecord = Omit<KnowledgeAsset, 'references'>

type KnowledgeAssetRow = {
  id: string
  project_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

const knowledgeAssetFromRow = (row: KnowledgeAssetRow): KnowledgeAssetRecord => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const findKnowledgeAssetRecord = (id: string) => {
  const row = useDatabase().prepare('SELECT * FROM knowledge_assets WHERE id = ?')
    .get(id) as KnowledgeAssetRow | undefined
  return row ? knowledgeAssetFromRow(row) : undefined
}

export const listKnowledgeAssetRecords = (projectId: string) => (useDatabase().prepare(`
  SELECT * FROM knowledge_assets
  WHERE project_id = ? ORDER BY updated_at DESC
`).all(projectId) as KnowledgeAssetRow[]).map(knowledgeAssetFromRow)

export const insertKnowledgeAssetRecord = (knowledge: KnowledgeAssetRecord) => {
  useDatabase().prepare(`
    INSERT INTO knowledge_assets (id, project_id, title, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    knowledge.id,
    knowledge.projectId,
    knowledge.title,
    knowledge.content,
    knowledge.createdAt,
    knowledge.updatedAt,
  )
}

export const updateKnowledgeAssetRecord = (knowledge: KnowledgeAssetRecord) => {
  useDatabase().prepare(`
    UPDATE knowledge_assets SET title = ?, content = ?, updated_at = ? WHERE id = ?
  `).run(knowledge.title, knowledge.content, knowledge.updatedAt, knowledge.id)
}

export const removeKnowledgeAsset = (id: string) => {
  useDatabase().prepare('DELETE FROM knowledge_assets WHERE id = ?').run(id)
}

import type { RequirementVersion } from '../../shared/types/asdp'
import { useDatabase } from '../utils/database'

export type RequirementVersionRecord = Omit<RequirementVersion, 'isLatest'>

type RequirementVersionRow = {
  id: string
  project_id: string
  major: number
  requirement_count: number
  created_at: string
  updated_at: string
}

const requirementVersionFromRow = (row: RequirementVersionRow): RequirementVersionRecord => ({
  id: row.id,
  projectId: row.project_id,
  major: Number(row.major),
  name: `v${Number(row.major)}.x`,
  requirementCount: Number(row.requirement_count || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const versionSelect = `
  SELECT v.*, (
    SELECT COUNT(*) FROM requirements r
    WHERE r.project_id = v.project_id
      AND INSTR(',' || r.version_ids || ',', ',' || v.id || ',') > 0
  ) AS requirement_count
  FROM requirement_versions v
`

export const findRequirementVersionRecord = (id: string) => {
  const row = useDatabase().prepare(`${versionSelect}
    WHERE v.id = ?
  `).get(id) as RequirementVersionRow | undefined
  return row ? requirementVersionFromRow(row) : undefined
}

export const listProjectRequirementVersionRecords = (projectId: string) => (useDatabase().prepare(`${versionSelect}
  WHERE v.project_id = ?
`).all(projectId) as RequirementVersionRow[]).map(requirementVersionFromRow)

export const countProjectRequirementVersions = (projectId: string, ids: string[]) => {
  if (!ids.length) return 0
  const placeholders = ids.map(() => '?').join(', ')
  const row = useDatabase().prepare(`
    SELECT COUNT(*) AS count FROM requirement_versions
    WHERE project_id = ? AND id IN (${placeholders})
  `).get(projectId, ...ids) as { count: number }
  return Number(row.count)
}

export const insertRequirementVersion = (version: RequirementVersionRecord) => {
  useDatabase().prepare(`
    INSERT INTO requirement_versions (id, project_id, major, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(version.id, version.projectId, version.major, version.createdAt, version.updatedAt)
}

export const updateRequirementVersionRecord = (version: RequirementVersionRecord) => {
  useDatabase().prepare(`
    UPDATE requirement_versions SET major = ?, updated_at = ? WHERE id = ?
  `).run(version.major, version.updatedAt, version.id)
}

export const removeRequirementVersion = (id: string) => {
  useDatabase().prepare('DELETE FROM requirement_versions WHERE id = ?').run(id)
}

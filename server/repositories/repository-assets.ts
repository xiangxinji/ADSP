import type { RepositoryAsset, RepositoryLocalOperation } from '../../shared/types/asdp'
import { useDatabase } from '../utils/database'

type RepositoryRow = {
  id: string
  project_id: string
  provider: RepositoryAsset['provider']
  branch_strategy: RepositoryAsset['branchStrategy']
  external_id: string | null
  name: string
  note: string
  url: string
  local_operation_id: string | null
  local_operation_status: RepositoryLocalOperation['status'] | null
  local_operation_started_at: string | null
  local_operation_finished_at: string | null
  local_operation_error: string | null
  reference_count: number
  created_at: string
  updated_at: string
}

const repositoryFromRow = (row: RepositoryRow): RepositoryAsset => ({
  id: row.id,
  projectId: row.project_id,
  provider: row.provider,
  branchStrategy: row.branch_strategy,
  externalId: row.external_id || null,
  name: row.name,
  note: row.note || '',
  url: row.url,
  localOperation: row.local_operation_id && row.local_operation_status && row.local_operation_started_at
    ? {
        operationId: row.local_operation_id,
        status: row.local_operation_status,
        startedAt: row.local_operation_started_at,
        finishedAt: row.local_operation_finished_at,
        error: row.local_operation_error,
      }
    : null,
  referenceCount: Number(row.reference_count || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const findRepositoryAsset = (id: string) => {
  const row = useDatabase().prepare(`
    SELECT r.*, COUNT(rr.requirement_id) AS reference_count
    FROM repository_assets r
    LEFT JOIN requirement_repositories rr ON rr.repository_id = r.id
    WHERE r.id = ? GROUP BY r.id
  `).get(id) as RepositoryRow | undefined
  return row ? repositoryFromRow(row) : undefined
}

export const listRepositoryAssets = (projectId: string) => (useDatabase().prepare(`
  SELECT r.*, COUNT(rr.requirement_id) AS reference_count
  FROM repository_assets r
  LEFT JOIN requirement_repositories rr ON rr.repository_id = r.id
  WHERE r.project_id = ?
  GROUP BY r.id ORDER BY r.updated_at DESC
`).all(projectId) as RepositoryRow[]).map(repositoryFromRow)

export const listRequirementRepositories = (requirementId: string) => (useDatabase().prepare(`
  SELECT r.*, 0 AS reference_count FROM repository_assets r
  JOIN requirement_repositories rr ON rr.repository_id = r.id
  WHERE rr.requirement_id = ? ORDER BY r.name
`).all(requirementId) as RepositoryRow[]).map(repositoryFromRow)

export const countProjectRepositoryAssets = (projectId: string, ids: string[]) => {
  if (ids.length === 0) return 0
  const placeholders = ids.map(() => '?').join(', ')
  const row = useDatabase().prepare(`
    SELECT COUNT(*) AS count FROM repository_assets
    WHERE project_id = ? AND id IN (${placeholders})
  `).get(projectId, ...ids) as { count: number }
  return Number(row.count)
}

export const insertRepositoryAsset = (repository: RepositoryAsset) => {
  useDatabase().prepare(`
    INSERT INTO repository_assets
      (id, project_id, provider, branch_strategy, external_id, name, note, url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    repository.id,
    repository.projectId,
    repository.provider,
    repository.branchStrategy,
    repository.externalId,
    repository.name,
    repository.note,
    repository.url,
    repository.createdAt,
    repository.updatedAt,
  )
}

export const updateRepositoryAssetRecord = (repository: RepositoryAsset) => {
  useDatabase().prepare(`
    UPDATE repository_assets
    SET provider = ?, branch_strategy = ?, external_id = ?, name = ?, note = ?, url = ?, updated_at = ?
    WHERE id = ?
  `).run(
    repository.provider,
    repository.branchStrategy,
    repository.externalId,
    repository.name,
    repository.note,
    repository.url,
    repository.updatedAt,
    repository.id,
  )
}

export const updateRepositoryLocalOperationRecord = (
  id: string,
  operation: RepositoryLocalOperation,
) => {
  useDatabase().prepare(`
    UPDATE repository_assets
    SET local_operation_id = ?, local_operation_status = ?, local_operation_started_at = ?,
        local_operation_finished_at = ?, local_operation_error = ?, updated_at = ?
    WHERE id = ?
  `).run(
    operation.operationId,
    operation.status,
    operation.startedAt,
    operation.finishedAt,
    operation.error,
    operation.finishedAt || operation.startedAt,
    id,
  )
}

export const removeRepositoryAsset = (id: string) => {
  useDatabase().prepare('DELETE FROM repository_assets WHERE id = ?').run(id)
}

import { randomUUID } from 'node:crypto'
import type { RequirementStatus } from '../../shared/types/asdp'
import { defaultRequirementStatuses } from '../domain/requirement-statuses'
import { useDatabase } from '../utils/database'

type RequirementStatusRow = {
  id: string
  project_id: string
  key: string
  name: string
  color: string
  sort_order: number
  is_initial: number
  is_terminal: number
  requirement_count: number
  created_at: string
  updated_at: string
}

const requirementStatusFromRow = (row: RequirementStatusRow): RequirementStatus => ({
  id: row.id,
  projectId: row.project_id,
  key: row.key,
  name: row.name,
  color: row.color,
  sortOrder: Number(row.sort_order),
  isInitial: Boolean(row.is_initial),
  isTerminal: Boolean(row.is_terminal),
  requirementCount: Number(row.requirement_count || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const statusSelect = `
  SELECT s.*, COUNT(r.id) AS requirement_count
  FROM requirement_statuses s
  LEFT JOIN requirements r ON r.status_id = s.id
`

export const findRequirementStatus = (id: string) => {
  const row = useDatabase().prepare(`${statusSelect}
    WHERE s.id = ? GROUP BY s.id
  `).get(id) as RequirementStatusRow | undefined
  return row ? requirementStatusFromRow(row) : undefined
}

export const findInitialRequirementStatus = (projectId: string) => {
  const row = useDatabase().prepare(`${statusSelect}
    WHERE s.project_id = ? AND s.is_initial = 1
    GROUP BY s.id
  `).get(projectId) as RequirementStatusRow | undefined
  return row ? requirementStatusFromRow(row) : undefined
}

export const listProjectRequirementStatuses = (projectId: string) => (useDatabase().prepare(`${statusSelect}
  WHERE s.project_id = ?
  GROUP BY s.id ORDER BY s.sort_order, s.created_at
`).all(projectId) as RequirementStatusRow[]).map(requirementStatusFromRow)

export const countProjectRequirementStatuses = (projectId: string) => {
  const row = useDatabase().prepare(`
    SELECT COUNT(*) AS count FROM requirement_statuses WHERE project_id = ?
  `).get(projectId) as { count: number }
  return Number(row.count)
}

export const insertRequirementStatus = (status: RequirementStatus) => {
  useDatabase().prepare(`
    INSERT INTO requirement_statuses
      (id, project_id, key, name, color, sort_order, is_initial, is_terminal, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    status.id,
    status.projectId,
    status.key,
    status.name,
    status.color,
    status.sortOrder,
    Number(status.isInitial),
    Number(status.isTerminal),
    status.createdAt,
    status.updatedAt,
  )
}

export const insertDefaultRequirementStatuses = (projectId: string, timestamp: string) => {
  defaultRequirementStatuses.forEach(status => insertRequirementStatus({
    id: randomUUID(),
    projectId,
    ...status,
    requirementCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
}

export const clearInitialRequirementStatus = (projectId: string, timestamp: string) => {
  useDatabase().prepare(`
    UPDATE requirement_statuses SET is_initial = 0, updated_at = ? WHERE project_id = ?
  `).run(timestamp, projectId)
}

export const updateRequirementStatusRecord = (status: RequirementStatus) => {
  useDatabase().prepare(`
    UPDATE requirement_statuses
    SET key = ?, name = ?, color = ?, sort_order = ?, is_initial = ?, is_terminal = ?, updated_at = ?
    WHERE id = ?
  `).run(
    status.key,
    status.name,
    status.color,
    status.sortOrder,
    Number(status.isInitial),
    Number(status.isTerminal),
    status.updatedAt,
    status.id,
  )
}

export const updateRequirementStatusKeyReferences = (statusId: string, key: string) => {
  useDatabase().prepare('UPDATE requirements SET status = ? WHERE status_id = ?').run(key, statusId)
}

export const removeRequirementStatus = (id: string) => {
  useDatabase().prepare('DELETE FROM requirement_statuses WHERE id = ?').run(id)
}

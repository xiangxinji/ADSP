import type { Requirement } from '../../shared/types/asdp'
import { useDatabase } from '../utils/database'

export type RequirementRecord = {
  id: string
  projectId: string
  title: string
  description: string
  acceptanceCriteria: string
  statusKey: string
  statusId: string
  priority: Requirement['priority']
  createdAt: string
  updatedAt: string
}

type RequirementRow = {
  id: string
  project_id: string
  title: string
  description: string
  acceptance_criteria: string
  status: string
  status_id: string
  priority: Requirement['priority']
  created_at: string
  updated_at: string
}

const requirementFromRow = (row: RequirementRow): RequirementRecord => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  description: row.description,
  acceptanceCriteria: row.acceptance_criteria,
  statusKey: row.status,
  statusId: row.status_id,
  priority: row.priority,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const findRequirementRecord = (id: string) => {
  const row = useDatabase().prepare('SELECT * FROM requirements WHERE id = ?').get(id) as RequirementRow | undefined
  return row ? requirementFromRow(row) : undefined
}

export const listProjectRequirementRecords = (projectId: string) => (useDatabase().prepare(`
  SELECT * FROM requirements WHERE project_id = ? ORDER BY updated_at DESC
`).all(projectId) as RequirementRow[]).map(requirementFromRow)

export const insertRequirementRecord = (requirement: RequirementRecord) => {
  useDatabase().prepare(`
    INSERT INTO requirements
      (id, project_id, title, description, acceptance_criteria, status, status_id, priority, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    requirement.id,
    requirement.projectId,
    requirement.title,
    requirement.description,
    requirement.acceptanceCriteria,
    requirement.statusKey,
    requirement.statusId,
    requirement.priority,
    requirement.createdAt,
    requirement.updatedAt,
  )
}

export const updateRequirementRecord = (requirement: RequirementRecord) => {
  useDatabase().prepare(`
    UPDATE requirements
    SET title = ?, description = ?, acceptance_criteria = ?, status = ?, status_id = ?, priority = ?, updated_at = ?
    WHERE id = ?
  `).run(
    requirement.title,
    requirement.description,
    requirement.acceptanceCriteria,
    requirement.statusKey,
    requirement.statusId,
    requirement.priority,
    requirement.updatedAt,
    requirement.id,
  )
}

export const replaceRequirementReferences = (
  requirementId: string,
  repositoryIds: string[],
  memberIds: string[],
) => {
  const database = useDatabase()
  database.prepare('DELETE FROM requirement_repositories WHERE requirement_id = ?').run(requirementId)
  database.prepare('DELETE FROM requirement_members WHERE requirement_id = ?').run(requirementId)
  const insertRepository = database.prepare(`
    INSERT INTO requirement_repositories (requirement_id, repository_id) VALUES (?, ?)
  `)
  const insertMember = database.prepare(`
    INSERT INTO requirement_members (requirement_id, member_id) VALUES (?, ?)
  `)
  repositoryIds.forEach(repositoryId => insertRepository.run(requirementId, repositoryId))
  memberIds.forEach(memberId => insertMember.run(requirementId, memberId))
}

export const removeRequirement = (id: string) => {
  useDatabase().prepare('DELETE FROM requirements WHERE id = ?').run(id)
}

import type { ProjectMember, UserAccount } from '../../shared/types/asdp'
import { useDatabase } from '../utils/database'

type ProjectMemberRow = {
  id: string
  project_id: string
  user_id: string
  role: string
  reference_count: number
  created_at: string
  updated_at: string
  user_name: string
  user_email: string
  user_role: UserAccount['role']
  user_created_at: string
  user_updated_at: string
}

const projectMemberFromRow = (row: ProjectMemberRow): ProjectMember => ({
  id: row.id,
  projectId: row.project_id,
  userId: row.user_id,
  user: {
    id: row.user_id,
    name: row.user_name,
    email: row.user_email,
    role: row.user_role,
    createdAt: row.user_created_at,
    updatedAt: row.user_updated_at,
  },
  role: row.role,
  referenceCount: Number(row.reference_count || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const memberSelect = `
  SELECT m.*, u.name AS user_name, u.email AS user_email, u.role AS user_role,
    u.created_at AS user_created_at, u.updated_at AS user_updated_at,
    COUNT(rm.requirement_id) AS reference_count
  FROM project_members m
  JOIN users u ON u.id = m.user_id
  LEFT JOIN requirement_members rm ON rm.member_id = m.id
`

export const findProjectMember = (id: string) => {
  const row = useDatabase().prepare(`${memberSelect}
    WHERE m.id = ? GROUP BY m.id
  `).get(id) as ProjectMemberRow | undefined
  return row ? projectMemberFromRow(row) : undefined
}

export const listProjectMembers = (projectId: string) => (useDatabase().prepare(`${memberSelect}
  WHERE m.project_id = ?
  GROUP BY m.id ORDER BY m.updated_at DESC
`).all(projectId) as ProjectMemberRow[]).map(projectMemberFromRow)

export const listRequirementMembers = (requirementId: string) => (useDatabase().prepare(`
  SELECT m.*, u.name AS user_name, u.email AS user_email, u.role AS user_role,
    u.created_at AS user_created_at, u.updated_at AS user_updated_at,
    0 AS reference_count
  FROM project_members m
  JOIN users u ON u.id = m.user_id
  JOIN requirement_members rm ON rm.member_id = m.id
  WHERE rm.requirement_id = ? ORDER BY u.name
`).all(requirementId) as ProjectMemberRow[]).map(projectMemberFromRow)

export const countProjectMembers = (projectId: string, ids: string[]) => {
  if (ids.length === 0) return 0
  const placeholders = ids.map(() => '?').join(', ')
  const row = useDatabase().prepare(`
    SELECT COUNT(*) AS count FROM project_members
    WHERE project_id = ? AND id IN (${placeholders})
  `).get(projectId, ...ids) as { count: number }
  return Number(row.count)
}

export const insertProjectMember = (member: ProjectMember) => {
  useDatabase().prepare(`
    INSERT INTO project_members (id, project_id, user_id, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(member.id, member.projectId, member.userId, member.role, member.createdAt, member.updatedAt)
}

export const updateProjectMemberRecord = (member: ProjectMember) => {
  useDatabase().prepare('UPDATE project_members SET role = ?, updated_at = ? WHERE id = ?')
    .run(member.role, member.updatedAt, member.id)
}

export const removeProjectMember = (id: string) => {
  useDatabase().prepare('DELETE FROM project_members WHERE id = ?').run(id)
}

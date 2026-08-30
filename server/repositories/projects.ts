import type { Project, ProjectSummary } from '../../shared/types/asdp'
import { useDatabase } from '../utils/database'

type ProjectRow = {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

const projectFromRow = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const findProject = (id: string) => {
  const row = useDatabase().prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  return row ? projectFromRow(row) : undefined
}

export const listProjectSummaries = (): ProjectSummary[] => (useDatabase().prepare(`
  SELECT p.*,
    (SELECT COUNT(*) FROM requirements r WHERE r.project_id = p.id) AS requirement_count,
    (SELECT COUNT(*) FROM repository_assets a WHERE a.project_id = p.id) AS repository_count,
    (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id) AS member_count
  FROM projects p ORDER BY p.updated_at DESC
`).all() as (ProjectRow & {
  requirement_count: number
  repository_count: number
  member_count: number
})[]).map(row => ({
  ...projectFromRow(row),
  requirementCount: Number(row.requirement_count),
  repositoryCount: Number(row.repository_count),
  memberCount: Number(row.member_count),
}))

export const insertProject = (project: Project) => {
  useDatabase().prepare(`
    INSERT INTO projects (id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(project.id, project.name, project.description, project.createdAt, project.updatedAt)
}

export const updateProjectRecord = (project: Project) => {
  useDatabase().prepare('UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?')
    .run(project.name, project.description, project.updatedAt, project.id)
}

export const removeProject = (id: string) => {
  useDatabase().prepare('DELETE FROM projects WHERE id = ?').run(id)
}

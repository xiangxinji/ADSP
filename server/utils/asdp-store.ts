import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type {
  CreatePersonInput,
  CreateProjectInput,
  CreateRepositoryInput,
  CreateRequirementInput,
  CreateRequirementStatusInput,
  PersonAsset,
  Project,
  ProjectSummary,
  ProjectWorkspace,
  RepositoryAsset,
  Requirement,
  RequirementStatus,
  UpdatePersonInput,
  UpdateProjectInput,
  UpdateRepositoryInput,
  UpdateRequirementInput,
  UpdateRequirementStatusInput,
} from '../../shared/types/asdp'
import { seedDefaultRequirementStatuses, useDatabase } from './database'

type ProjectRow = { id: string, name: string, description: string, created_at: string, updated_at: string }
type RepositoryRow = { id: string, project_id: string, provider: RepositoryAsset['provider'], name: string, url: string, default_branch: string, reference_count: number, created_at: string, updated_at: string }
type PersonRow = { id: string, project_id: string, name: string, email: string, role: string, reference_count: number, created_at: string, updated_at: string }
type RequirementStatusRow = { id: string, project_id: string, key: string, name: string, color: string, sort_order: number, is_initial: number, is_terminal: number, requirement_count: number, created_at: string, updated_at: string }
type RequirementRow = { id: string, project_id: string, title: string, description: string, acceptance_criteria: string, status: string, status_id: string, priority: Requirement['priority'], created_at: string, updated_at: string }

const now = () => new Date().toISOString()

const projectFromRow = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const repositoryFromRow = (row: RepositoryRow): RepositoryAsset => ({
  id: row.id,
  projectId: row.project_id,
  provider: row.provider,
  name: row.name,
  url: row.url,
  defaultBranch: row.default_branch,
  referenceCount: Number(row.reference_count || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const personFromRow = (row: PersonRow): PersonAsset => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  email: row.email,
  role: row.role,
  referenceCount: Number(row.reference_count || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

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

const getProjectRow = (id: string) => {
  const row = useDatabase().prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  return row
}

const getRepositoryRow = (id: string) => {
  const row = useDatabase().prepare(`
    SELECT r.*, COUNT(rr.requirement_id) AS reference_count
    FROM repository_assets r
    LEFT JOIN requirement_repositories rr ON rr.repository_id = r.id
    WHERE r.id = ? GROUP BY r.id
  `).get(id) as RepositoryRow | undefined
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Repository not found' })
  return row
}

const getPersonRow = (id: string) => {
  const row = useDatabase().prepare(`
    SELECT p.*, COUNT(rp.requirement_id) AS reference_count
    FROM people p
    LEFT JOIN requirement_people rp ON rp.person_id = p.id
    WHERE p.id = ? GROUP BY p.id
  `).get(id) as PersonRow | undefined
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  return row
}

const getRequirementRow = (id: string) => {
  const row = useDatabase().prepare('SELECT * FROM requirements WHERE id = ?').get(id) as RequirementRow | undefined
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Requirement not found' })
  return row
}

const getRequirementStatusRow = (id: string) => {
  const row = useDatabase().prepare(`
    SELECT s.*, COUNT(r.id) AS requirement_count
    FROM requirement_statuses s
    LEFT JOIN requirements r ON r.status_id = s.id
    WHERE s.id = ? GROUP BY s.id
  `).get(id) as RequirementStatusRow | undefined
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Requirement status not found' })
  return row
}

const listRequirementStatuses = (projectId: string) => (useDatabase().prepare(`
  SELECT s.*, COUNT(r.id) AS requirement_count
  FROM requirement_statuses s
  LEFT JOIN requirements r ON r.status_id = s.id
  WHERE s.project_id = ?
  GROUP BY s.id ORDER BY s.sort_order, s.created_at
`).all(projectId) as RequirementStatusRow[]).map(requirementStatusFromRow)

const listRepositories = (projectId: string) => (useDatabase().prepare(`
  SELECT r.*, COUNT(rr.requirement_id) AS reference_count
  FROM repository_assets r
  LEFT JOIN requirement_repositories rr ON rr.repository_id = r.id
  WHERE r.project_id = ?
  GROUP BY r.id ORDER BY r.updated_at DESC
`).all(projectId) as RepositoryRow[]).map(repositoryFromRow)

const listPeople = (projectId: string) => (useDatabase().prepare(`
  SELECT p.*, COUNT(rp.requirement_id) AS reference_count
  FROM people p
  LEFT JOIN requirement_people rp ON rp.person_id = p.id
  WHERE p.project_id = ?
  GROUP BY p.id ORDER BY p.updated_at DESC
`).all(projectId) as PersonRow[]).map(personFromRow)

const requirementFromRow = (row: RequirementRow): Requirement => {
  const database = useDatabase()
  const status = requirementStatusFromRow(getRequirementStatusRow(row.status_id))
  const repositories = (database.prepare(`
    SELECT r.*, 0 AS reference_count FROM repository_assets r
    JOIN requirement_repositories rr ON rr.repository_id = r.id
    WHERE rr.requirement_id = ? ORDER BY r.name
  `).all(row.id) as RepositoryRow[]).map(repositoryFromRow)
  const people = (database.prepare(`
    SELECT p.*, 0 AS reference_count FROM people p
    JOIN requirement_people rp ON rp.person_id = p.id
    WHERE rp.requirement_id = ? ORDER BY p.name
  `).all(row.id) as PersonRow[]).map(personFromRow)

  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    acceptanceCriteria: row.acceptance_criteria,
    statusId: row.status_id,
    status,
    priority: row.priority,
    repositoryIds: repositories.map(repository => repository.id),
    personIds: people.map(person => person.id),
    repositories,
    people,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const listRequirements = (projectId: string) => (useDatabase().prepare(`
  SELECT * FROM requirements WHERE project_id = ? ORDER BY updated_at DESC
`).all(projectId) as RequirementRow[]).map(requirementFromRow)

const validateAssetIds = (projectId: string, table: 'repository_assets' | 'people', ids: string[]) => {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(', ')
  const rows = useDatabase().prepare(`SELECT id FROM ${table} WHERE project_id = ? AND id IN (${placeholders})`).all(projectId, ...ids) as { id: string }[]
  if (rows.length !== ids.length) {
    throw createError({ statusCode: 400, statusMessage: 'One or more referenced assets do not belong to this project' })
  }
}

export const listProjects = (): ProjectSummary[] => (useDatabase().prepare(`
  SELECT p.*,
    (SELECT COUNT(*) FROM requirements r WHERE r.project_id = p.id) AS requirement_count,
    (SELECT COUNT(*) FROM repository_assets a WHERE a.project_id = p.id) AS repository_count,
    (SELECT COUNT(*) FROM people m WHERE m.project_id = p.id) AS person_count
  FROM projects p ORDER BY p.updated_at DESC
`).all() as (ProjectRow & { requirement_count: number, repository_count: number, person_count: number })[]).map(row => ({
  ...projectFromRow(row),
  requirementCount: Number(row.requirement_count),
  repositoryCount: Number(row.repository_count),
  personCount: Number(row.person_count),
}))

export const getProjectWorkspace = (id: string): ProjectWorkspace => {
  const project = projectFromRow(getProjectRow(id))
  return {
    project,
    requirements: listRequirements(id),
    requirementStatuses: listRequirementStatuses(id),
    repositories: listRepositories(id),
    people: listPeople(id),
  }
}

export const createProject = (input: CreateProjectInput) => {
  const id = randomUUID()
  const timestamp = now()
  const database = useDatabase()
  database.transaction(() => {
    database.prepare('INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, input.name, input.description, timestamp, timestamp)
    seedDefaultRequirementStatuses(id)
  })()
  return projectFromRow(getProjectRow(id))
}

export const updateProject = (id: string, input: UpdateProjectInput) => {
  const current = projectFromRow(getProjectRow(id))
  useDatabase().prepare('UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?')
    .run(input.name ?? current.name, input.description ?? current.description, now(), id)
  return projectFromRow(getProjectRow(id))
}

export const deleteProject = (id: string) => {
  getProjectRow(id)
  useDatabase().prepare('DELETE FROM projects WHERE id = ?').run(id)
}

export const createRequirementStatus = (projectId: string, input: CreateRequirementStatusInput) => {
  getProjectRow(projectId)
  const id = randomUUID()
  const timestamp = now()
  const database = useDatabase()
  try {
    database.transaction(() => {
      if (input.isInitial) {
        database.prepare('UPDATE requirement_statuses SET is_initial = 0, updated_at = ? WHERE project_id = ?')
          .run(timestamp, projectId)
      }
      database.prepare(`
        INSERT INTO requirement_statuses
          (id, project_id, key, name, color, sort_order, is_initial, is_terminal, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, projectId, input.key, input.name, input.color, input.sortOrder,
        input.isInitial ? 1 : 0, input.isTerminal ? 1 : 0, timestamp, timestamp,
      )
    })()
  } catch (error) {
    throw createError({ statusCode: 409, statusMessage: 'This status key already exists in the project', cause: error })
  }
  return requirementStatusFromRow(getRequirementStatusRow(id))
}

export const updateRequirementStatus = (id: string, input: UpdateRequirementStatusInput) => {
  const current = requirementStatusFromRow(getRequirementStatusRow(id))
  if (current.isInitial && input.isInitial === false) {
    throw createError({ statusCode: 409, statusMessage: 'Designate another initial status before clearing this one' })
  }

  const database = useDatabase()
  const timestamp = now()
  try {
    database.transaction(() => {
      if (input.isInitial && !current.isInitial) {
        database.prepare('UPDATE requirement_statuses SET is_initial = 0, updated_at = ? WHERE project_id = ?')
          .run(timestamp, current.projectId)
      }
      const key = input.key ?? current.key
      database.prepare(`
        UPDATE requirement_statuses
        SET key = ?, name = ?, color = ?, sort_order = ?, is_initial = ?, is_terminal = ?, updated_at = ?
        WHERE id = ?
      `).run(
        key,
        input.name ?? current.name,
        input.color ?? current.color,
        input.sortOrder ?? current.sortOrder,
        input.isInitial === undefined ? Number(current.isInitial) : Number(input.isInitial),
        input.isTerminal === undefined ? Number(current.isTerminal) : Number(input.isTerminal),
        timestamp,
        id,
      )
      database.prepare('UPDATE requirements SET status = ? WHERE status_id = ?').run(key, id)
    })()
  } catch (error) {
    throw createError({ statusCode: 409, statusMessage: 'This status key already exists in the project', cause: error })
  }
  return requirementStatusFromRow(getRequirementStatusRow(id))
}

export const deleteRequirementStatus = (id: string) => {
  const status = requirementStatusFromRow(getRequirementStatusRow(id))
  if (status.requirementCount > 0) {
    throw createError({ statusCode: 409, statusMessage: `Reassign ${status.requirementCount} requirement(s) before deleting this status` })
  }
  if (status.isInitial) {
    throw createError({ statusCode: 409, statusMessage: 'Designate another initial status before deleting this one' })
  }
  const count = useDatabase().prepare('SELECT COUNT(*) AS count FROM requirement_statuses WHERE project_id = ?')
    .get(status.projectId) as { count: number }
  if (Number(count.count) <= 1) {
    throw createError({ statusCode: 409, statusMessage: 'A project must keep at least one requirement status' })
  }
  useDatabase().prepare('DELETE FROM requirement_statuses WHERE id = ?').run(id)
}

export const createRepository = (projectId: string, input: CreateRepositoryInput) => {
  getProjectRow(projectId)
  const id = randomUUID()
  const timestamp = now()
  try {
    useDatabase().prepare(`INSERT INTO repository_assets (id, project_id, provider, name, url, default_branch, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, projectId, input.provider, input.name, input.url, input.defaultBranch, timestamp, timestamp)
  } catch (error) {
    throw createError({ statusCode: 409, statusMessage: 'This repository URL is already registered in the project', cause: error })
  }
  return repositoryFromRow(getRepositoryRow(id))
}

export const updateRepository = (id: string, input: UpdateRepositoryInput) => {
  const current = repositoryFromRow(getRepositoryRow(id))
  try {
    useDatabase().prepare('UPDATE repository_assets SET provider = ?, name = ?, url = ?, default_branch = ?, updated_at = ? WHERE id = ?')
      .run(input.provider ?? current.provider, input.name ?? current.name, input.url ?? current.url, input.defaultBranch ?? current.defaultBranch, now(), id)
  } catch (error) {
    throw createError({ statusCode: 409, statusMessage: 'This repository URL is already registered in the project', cause: error })
  }
  return repositoryFromRow(getRepositoryRow(id))
}

export const deleteRepository = (id: string) => {
  getRepositoryRow(id)
  useDatabase().prepare('DELETE FROM repository_assets WHERE id = ?').run(id)
}

export const createPerson = (projectId: string, input: CreatePersonInput) => {
  getProjectRow(projectId)
  const id = randomUUID()
  const timestamp = now()
  try {
    useDatabase().prepare('INSERT INTO people (id, project_id, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, projectId, input.name, input.email, input.role, timestamp, timestamp)
  } catch (error) {
    throw createError({ statusCode: 409, statusMessage: 'This email is already registered in the project', cause: error })
  }
  return personFromRow(getPersonRow(id))
}

export const updatePerson = (id: string, input: UpdatePersonInput) => {
  const current = personFromRow(getPersonRow(id))
  try {
    useDatabase().prepare('UPDATE people SET name = ?, email = ?, role = ?, updated_at = ? WHERE id = ?')
      .run(input.name ?? current.name, input.email ?? current.email, input.role ?? current.role, now(), id)
  } catch (error) {
    throw createError({ statusCode: 409, statusMessage: 'This email is already registered in the project', cause: error })
  }
  return personFromRow(getPersonRow(id))
}

export const deletePerson = (id: string) => {
  getPersonRow(id)
  useDatabase().prepare('DELETE FROM people WHERE id = ?').run(id)
}

const replaceRequirementAssets = (requirementId: string, projectId: string, repositoryIds: string[], personIds: string[]) => {
  validateAssetIds(projectId, 'repository_assets', repositoryIds)
  validateAssetIds(projectId, 'people', personIds)
  const database = useDatabase()
  database.prepare('DELETE FROM requirement_repositories WHERE requirement_id = ?').run(requirementId)
  database.prepare('DELETE FROM requirement_people WHERE requirement_id = ?').run(requirementId)
  const insertRepository = database.prepare('INSERT INTO requirement_repositories (requirement_id, repository_id) VALUES (?, ?)')
  const insertPerson = database.prepare('INSERT INTO requirement_people (requirement_id, person_id) VALUES (?, ?)')
  repositoryIds.forEach(repositoryId => insertRepository.run(requirementId, repositoryId))
  personIds.forEach(personId => insertPerson.run(requirementId, personId))
}

const resolveRequirementStatus = (projectId: string, statusId?: string) => {
  const row = statusId
    ? getRequirementStatusRow(statusId)
    : useDatabase().prepare(`
        SELECT s.*, COUNT(r.id) AS requirement_count
        FROM requirement_statuses s
        LEFT JOIN requirements r ON r.status_id = s.id
        WHERE s.project_id = ? AND s.is_initial = 1
        GROUP BY s.id
      `).get(projectId) as RequirementStatusRow | undefined
  if (!row || row.project_id !== projectId) {
    throw createError({ statusCode: 400, statusMessage: 'Requirement status does not belong to this project' })
  }
  return requirementStatusFromRow(row)
}

export const createRequirement = (projectId: string, input: CreateRequirementInput) => {
  getProjectRow(projectId)
  const status = resolveRequirementStatus(projectId, input.statusId)
  const id = randomUUID()
  const timestamp = now()
  const database = useDatabase()
  database.transaction(() => {
    database.prepare(`
      INSERT INTO requirements (id, project_id, title, description, acceptance_criteria, status, status_id, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, input.title, input.description, input.acceptanceCriteria, status.key, status.id, input.priority, timestamp, timestamp)
    replaceRequirementAssets(id, projectId, input.repositoryIds, input.personIds)
  })()
  return requirementFromRow(getRequirementRow(id))
}

export const updateRequirement = (id: string, input: UpdateRequirementInput) => {
  const current = requirementFromRow(getRequirementRow(id))
  const status = resolveRequirementStatus(current.projectId, input.statusId ?? current.statusId)
  const database = useDatabase()
  database.transaction(() => {
    database.prepare(`
      UPDATE requirements SET title = ?, description = ?, acceptance_criteria = ?, status = ?, status_id = ?, priority = ?, updated_at = ? WHERE id = ?
    `).run(
      input.title ?? current.title,
      input.description ?? current.description,
      input.acceptanceCriteria ?? current.acceptanceCriteria,
      status.key,
      status.id,
      input.priority ?? current.priority,
      now(),
      id,
    )
    replaceRequirementAssets(
      id,
      current.projectId,
      input.repositoryIds ?? current.repositoryIds,
      input.personIds ?? current.personIds,
    )
  })()
  return requirementFromRow(getRequirementRow(id))
}

export const deleteRequirement = (id: string) => {
  getRequirementRow(id)
  useDatabase().prepare('DELETE FROM requirements WHERE id = ?').run(id)
}

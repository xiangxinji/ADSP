import { randomUUID } from 'node:crypto'
import type { CreateProjectInput, Project, UpdateProjectInput } from '../../shared/types/asdp'
import {
  findProject,
  insertProject,
  listProjectSummaries,
  removeProject,
  updateProjectRecord,
} from '../repositories/projects'
import { insertDefaultRequirementStatuses } from '../repositories/requirement-statuses'
import { runInTransaction } from '../repositories/unit-of-work'
import { requireEntity } from './errors'

export const listProjects = () => listProjectSummaries()

export const getProject = (id: string) => requireEntity(findProject(id), 'Project not found')

export const createProject = (input: CreateProjectInput) => {
  const timestamp = new Date().toISOString()
  const project: Project = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  runInTransaction(() => {
    insertProject(project)
    insertDefaultRequirementStatuses(project.id, timestamp)
  })
  return getProject(project.id)
}

export const updateProject = (id: string, input: UpdateProjectInput) => {
  const current = getProject(id)
  updateProjectRecord({
    ...current,
    name: input.name ?? current.name,
    description: input.description ?? current.description,
    updatedAt: new Date().toISOString(),
  })
  return getProject(id)
}

export const deleteProject = (id: string) => {
  getProject(id)
  removeProject(id)
}

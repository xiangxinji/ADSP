import { randomUUID } from 'node:crypto'
import type {
  CreateProjectMemberInput,
  ProjectMember,
  UpdateProjectMemberInput,
} from '../../shared/types/asdp'
import {
  findProjectMember,
  insertProjectMember,
  listProjectMembers,
  removeProjectMember,
  updateProjectMemberRecord,
} from '../repositories/project-members'
import { conflict, requireEntity } from './errors'
import { getProject } from './projects'
import { getUser } from './users'

export const getProjectMember = (id: string) => requireEntity(findProjectMember(id), 'Project member not found')

export const listMembersForProject = (projectId: string) => listProjectMembers(projectId)

export const createProjectMember = (projectId: string, input: CreateProjectMemberInput) => {
  getProject(projectId)
  const user = getUser(input.userId)
  const timestamp = new Date().toISOString()
  const member: ProjectMember = {
    id: randomUUID(),
    projectId,
    userId: user.id,
    user,
    role: input.role,
    referenceCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  try {
    insertProjectMember(member)
  } catch (error) {
    throw conflict('This user is already a member of the project', error)
  }
  return getProjectMember(member.id)
}

export const updateProjectMember = (id: string, input: UpdateProjectMemberInput) => {
  const current = getProjectMember(id)
  updateProjectMemberRecord({
    ...current,
    role: input.role ?? current.role,
    updatedAt: new Date().toISOString(),
  })
  return getProjectMember(id)
}

export const deleteProjectMember = (id: string) => {
  getProjectMember(id)
  removeProjectMember(id)
}

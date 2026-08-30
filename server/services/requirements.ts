import { randomUUID } from 'node:crypto'
import type {
  CreateRequirementInput,
  Requirement,
  UpdateRequirementInput,
} from '../../shared/types/asdp'
import { countProjectMembers, listRequirementMembers } from '../repositories/project-members'
import {
  countProjectRepositoryAssets,
  listRequirementRepositories,
} from '../repositories/repository-assets'
import {
  findInitialRequirementStatus,
  findRequirementStatus,
} from '../repositories/requirement-statuses'
import {
  findRequirementRecord,
  insertRequirementRecord,
  listProjectRequirementRecords,
  removeRequirement,
  replaceRequirementReferences,
  type RequirementRecord,
  updateRequirementRecord,
} from '../repositories/requirements'
import { runInTransaction } from '../repositories/unit-of-work'
import { badRequest, requireEntity } from './errors'
import { getProject } from './projects'

const resolveStatus = (projectId: string, statusId?: string) => {
  const status = statusId
    ? findRequirementStatus(statusId)
    : findInitialRequirementStatus(projectId)
  if (!status || status.projectId !== projectId) {
    throw badRequest('Requirement status does not belong to this project')
  }
  return status
}

const validateReferences = (projectId: string, repositoryIds: string[], memberIds: string[]) => {
  const repositoryCount = countProjectRepositoryAssets(projectId, repositoryIds)
  const memberCount = countProjectMembers(projectId, memberIds)
  if (repositoryCount !== repositoryIds.length || memberCount !== memberIds.length) {
    throw badRequest('One or more referenced assets do not belong to this project')
  }
}

const hydrateRequirement = (record: RequirementRecord): Requirement => {
  const status = requireEntity(findRequirementStatus(record.statusId), 'Requirement status not found')
  const repositories = listRequirementRepositories(record.id)
  const members = listRequirementMembers(record.id)
  return {
    id: record.id,
    projectId: record.projectId,
    title: record.title,
    description: record.description,
    acceptanceCriteria: record.acceptanceCriteria,
    statusId: record.statusId,
    status,
    priority: record.priority,
    repositoryIds: repositories.map(repository => repository.id),
    memberIds: members.map(member => member.id),
    repositories,
    members,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

const getRequirementRecord = (id: string) => requireEntity(
  findRequirementRecord(id),
  'Requirement not found',
)

export const getRequirement = (id: string) => hydrateRequirement(getRequirementRecord(id))

export const listRequirementsForProject = (projectId: string) => listProjectRequirementRecords(projectId)
  .map(hydrateRequirement)

export const createRequirement = (projectId: string, input: CreateRequirementInput) => {
  getProject(projectId)
  const status = resolveStatus(projectId, input.statusId)
  validateReferences(projectId, input.repositoryIds, input.memberIds)
  const timestamp = new Date().toISOString()
  const record: RequirementRecord = {
    id: randomUUID(),
    projectId,
    title: input.title,
    description: input.description,
    acceptanceCriteria: input.acceptanceCriteria,
    statusKey: status.key,
    statusId: status.id,
    priority: input.priority,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  runInTransaction(() => {
    insertRequirementRecord(record)
    replaceRequirementReferences(record.id, input.repositoryIds, input.memberIds)
  })
  return getRequirement(record.id)
}

export const updateRequirement = (id: string, input: UpdateRequirementInput) => {
  const current = getRequirement(id)
  const status = resolveStatus(current.projectId, input.statusId ?? current.statusId)
  const repositoryIds = input.repositoryIds ?? current.repositoryIds
  const memberIds = input.memberIds ?? current.memberIds
  validateReferences(current.projectId, repositoryIds, memberIds)
  const record: RequirementRecord = {
    id: current.id,
    projectId: current.projectId,
    title: input.title ?? current.title,
    description: input.description ?? current.description,
    acceptanceCriteria: input.acceptanceCriteria ?? current.acceptanceCriteria,
    statusKey: status.key,
    statusId: status.id,
    priority: input.priority ?? current.priority,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  }
  runInTransaction(() => {
    updateRequirementRecord(record)
    replaceRequirementReferences(id, repositoryIds, memberIds)
  })
  return getRequirement(id)
}

export const deleteRequirement = (id: string) => {
  getRequirementRecord(id)
  removeRequirement(id)
}

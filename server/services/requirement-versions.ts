import { randomUUID } from 'node:crypto'
import type {
  CreateRequirementVersionInput,
  RequirementVersion,
  UpdateRequirementVersionInput,
} from '../../shared/types/asdp'
import {
  findRequirementVersionRecord,
  insertRequirementVersion,
  listProjectRequirementVersionRecords,
  removeRequirementVersion,
  type RequirementVersionRecord,
  updateRequirementVersionRecord,
} from '../repositories/requirement-versions'
import { conflict, requireEntity } from './errors'
import { getProject } from './projects'

const isDuplicateMajorError = (error: unknown) => error instanceof Error
  && error.message.includes('UNIQUE constraint failed: requirement_versions.project_id, requirement_versions.major')

const decorateVersions = (versions: RequirementVersionRecord[]): RequirementVersion[] => versions
  .sort((left, right) => right.major - left.major)
  .map((version, index) => ({ ...version, isLatest: index === 0 }))

export const listRequirementVersionsForProject = (projectId: string) => decorateVersions(
  listProjectRequirementVersionRecords(projectId),
)

export const getRequirementVersion = (id: string) => {
  const record = requireEntity(findRequirementVersionRecord(id), 'Requirement version not found')
  return requireEntity(
    listRequirementVersionsForProject(record.projectId).find(version => version.id === id),
    'Requirement version not found',
  )
}

export const listVersionsForRequirement = (versionIds: string[], projectId: string) => {
  const selectedIds = new Set(versionIds)
  return listRequirementVersionsForProject(projectId).filter(version => selectedIds.has(version.id))
}

export const createRequirementVersion = (projectId: string, input: CreateRequirementVersionInput) => {
  getProject(projectId)
  const timestamp = new Date().toISOString()
  const version: RequirementVersionRecord = {
    id: randomUUID(),
    projectId,
    major: input.major,
    name: `v${input.major}.x`,
    requirementCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  try {
    insertRequirementVersion(version)
  } catch (error) {
    if (isDuplicateMajorError(error)) {
      throw conflict('This requirement version already exists in the project', error)
    }
    throw error
  }
  return getRequirementVersion(version.id)
}

export const updateRequirementVersion = (id: string, input: UpdateRequirementVersionInput) => {
  const current = getRequirementVersion(id)
  const version: RequirementVersionRecord = {
    ...current,
    major: input.major ?? current.major,
    name: `v${input.major ?? current.major}.x`,
    updatedAt: new Date().toISOString(),
  }
  try {
    updateRequirementVersionRecord(version)
  } catch (error) {
    if (isDuplicateMajorError(error)) {
      throw conflict('This requirement version already exists in the project', error)
    }
    throw error
  }
  return getRequirementVersion(id)
}

export const deleteRequirementVersion = (id: string) => {
  const version = getRequirementVersion(id)
  if (version.requirementCount > 0) {
    throw conflict(`Remove this version from ${version.requirementCount} requirement(s) before deleting it`)
  }
  removeRequirementVersion(id)
}

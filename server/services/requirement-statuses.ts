import { randomUUID } from 'node:crypto'
import type {
  CreateRequirementStatusInput,
  RequirementStatus,
  UpdateRequirementStatusInput,
} from '../../shared/types/asdp'
import {
  clearInitialRequirementStatus,
  countProjectRequirementStatuses,
  findRequirementStatus,
  insertRequirementStatus,
  listProjectRequirementStatuses,
  removeRequirementStatus,
  updateRequirementStatusKeyReferences,
  updateRequirementStatusRecord,
} from '../repositories/requirement-statuses'
import { runInTransaction } from '../repositories/unit-of-work'
import { conflict, requireEntity } from './errors'
import { getProject } from './projects'

export const getRequirementStatus = (id: string) => requireEntity(
  findRequirementStatus(id),
  'Requirement status not found',
)

export const listRequirementStatusesForProject = (projectId: string) => listProjectRequirementStatuses(projectId)

export const createRequirementStatus = (projectId: string, input: CreateRequirementStatusInput) => {
  getProject(projectId)
  const timestamp = new Date().toISOString()
  const status: RequirementStatus = {
    id: randomUUID(),
    projectId,
    ...input,
    requirementCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  try {
    runInTransaction(() => {
      if (status.isInitial) clearInitialRequirementStatus(projectId, timestamp)
      insertRequirementStatus(status)
    })
  } catch (error) {
    throw conflict('This status key already exists in the project', error)
  }
  return getRequirementStatus(status.id)
}

export const updateRequirementStatus = (id: string, input: UpdateRequirementStatusInput) => {
  const current = getRequirementStatus(id)
  if (current.isInitial && input.isInitial === false) {
    throw conflict('Designate another initial status before clearing this one')
  }

  const timestamp = new Date().toISOString()
  const status: RequirementStatus = {
    ...current,
    key: input.key ?? current.key,
    name: input.name ?? current.name,
    color: input.color ?? current.color,
    sortOrder: input.sortOrder ?? current.sortOrder,
    isInitial: input.isInitial ?? current.isInitial,
    isTerminal: input.isTerminal ?? current.isTerminal,
    updatedAt: timestamp,
  }
  try {
    runInTransaction(() => {
      if (status.isInitial && !current.isInitial) {
        clearInitialRequirementStatus(current.projectId, timestamp)
      }
      updateRequirementStatusRecord(status)
      updateRequirementStatusKeyReferences(status.id, status.key)
    })
  } catch (error) {
    throw conflict('This status key already exists in the project', error)
  }
  return getRequirementStatus(id)
}

export const deleteRequirementStatus = (id: string) => {
  const status = getRequirementStatus(id)
  if (status.requirementCount > 0) {
    throw conflict(`Reassign ${status.requirementCount} requirement(s) before deleting this status`)
  }
  if (status.isInitial) {
    throw conflict('Designate another initial status before deleting this one')
  }
  if (countProjectRequirementStatuses(status.projectId) <= 1) {
    throw conflict('A project must keep at least one requirement status')
  }
  removeRequirementStatus(id)
}

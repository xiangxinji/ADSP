import { createError } from 'h3'
import type {
  CreatePersonInput,
  CreateProjectInput,
  CreateRepositoryInput,
  CreateRequirementInput,
  CreateRequirementStatusInput,
  UpdatePersonInput,
  UpdateProjectInput,
  UpdateRepositoryInput,
  UpdateRequirementInput,
  UpdateRequirementStatusInput,
} from '../../shared/types/asdp'
import { repositoryProviders, requirementPriorities } from '../../shared/types/asdp'
import { bodyObject, enumValue, optionalStringArray, optionalText, requiredText } from './http-input'

export const projectPayload = (value: unknown, partial = false): CreateProjectInput | UpdateProjectInput => {
  const body = bodyObject(value)
  return {
    name: partial && body.name === undefined ? undefined : requiredText(body.name, 'name'),
    description: partial && body.description === undefined ? undefined : optionalText(body.description),
  }
}

export const repositoryPayload = (value: unknown, partial = false): CreateRepositoryInput | UpdateRepositoryInput => {
  const body = bodyObject(value)
  return {
    provider: partial && body.provider === undefined ? undefined : enumValue(body.provider, repositoryProviders, 'gitlab'),
    name: partial && body.name === undefined ? undefined : requiredText(body.name, 'name'),
    url: partial && body.url === undefined ? undefined : requiredText(body.url, 'url'),
    defaultBranch: partial && body.defaultBranch === undefined ? undefined : optionalText(body.defaultBranch, 'main') || 'main',
  }
}

export const personPayload = (value: unknown, partial = false): CreatePersonInput | UpdatePersonInput => {
  const body = bodyObject(value)
  return {
    name: partial && body.name === undefined ? undefined : requiredText(body.name, 'name'),
    email: partial && body.email === undefined ? undefined : requiredText(body.email, 'email'),
    role: partial && body.role === undefined ? undefined : optionalText(body.role, 'Member') || 'Member',
  }
}

export const requirementPayload = (value: unknown, partial = false): CreateRequirementInput | UpdateRequirementInput => {
  const body = bodyObject(value)
  return {
    title: partial && body.title === undefined ? undefined : requiredText(body.title, 'title'),
    description: partial && body.description === undefined ? undefined : optionalText(body.description),
    acceptanceCriteria: partial && body.acceptanceCriteria === undefined ? undefined : optionalText(body.acceptanceCriteria),
    statusId: body.statusId === undefined ? undefined : requiredText(body.statusId, 'statusId'),
    priority: partial && body.priority === undefined ? undefined : enumValue(body.priority, requirementPriorities, 'medium'),
    repositoryIds: partial && body.repositoryIds === undefined ? undefined : optionalStringArray(body.repositoryIds),
    personIds: partial && body.personIds === undefined ? undefined : optionalStringArray(body.personIds),
  }
}

export const requirementStatusPayload = (value: unknown, partial = false): CreateRequirementStatusInput | UpdateRequirementStatusInput => {
  const body = bodyObject(value)
  const key = partial && body.key === undefined ? undefined : requiredText(body.key, 'key')
  const color = partial && body.color === undefined ? undefined : requiredText(body.color, 'color')

  if (key !== undefined && !/^[a-z][a-z0-9_]*$/.test(key)) {
    throw createError({ statusCode: 400, statusMessage: 'key must use lowercase letters, numbers, and underscores' })
  }
  if (color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw createError({ statusCode: 400, statusMessage: 'color must be a six-digit hex value' })
  }
  if ((!partial || body.sortOrder !== undefined) && (!Number.isInteger(body.sortOrder) || Number(body.sortOrder) < 0)) {
    throw createError({ statusCode: 400, statusMessage: 'sortOrder must be a non-negative integer' })
  }
  for (const field of ['isInitial', 'isTerminal'] as const) {
    if ((!partial || body[field] !== undefined) && typeof body[field] !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: `${field} must be a boolean` })
    }
  }

  return {
    key,
    name: partial && body.name === undefined ? undefined : requiredText(body.name, 'name'),
    color,
    sortOrder: partial && body.sortOrder === undefined ? undefined : Number(body.sortOrder),
    isInitial: partial && body.isInitial === undefined ? undefined : Boolean(body.isInitial),
    isTerminal: partial && body.isTerminal === undefined ? undefined : Boolean(body.isTerminal),
  }
}

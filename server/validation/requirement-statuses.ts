import { createError } from 'h3'
import type {
  CreateRequirementStatusInput,
  UpdateRequirementStatusInput,
} from '../../shared/types/asdp'
import { bodyObject, requiredText } from '../utils/http-input'

export const requirementStatusPayload = (
  value: unknown,
  partial = false,
): CreateRequirementStatusInput | UpdateRequirementStatusInput => {
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

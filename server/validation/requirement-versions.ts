import { createError } from 'h3'
import type {
  CreateRequirementVersionInput,
  UpdateRequirementVersionInput,
} from '../../shared/types/asdp'
import { bodyObject } from '../utils/http-input'

export const requirementVersionPayload = (
  value: unknown,
  partial = false,
): CreateRequirementVersionInput | UpdateRequirementVersionInput => {
  const body = bodyObject(value)
  const major = partial && body.major === undefined ? undefined : Number(body.major)
  if (major !== undefined
    && (typeof body.major !== 'number' || !Number.isInteger(major) || major < 0)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'major must be a non-negative integer',
    })
  }
  return { major }
}

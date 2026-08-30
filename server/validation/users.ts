import { createError } from 'h3'
import type { CreateUserInput } from '../../shared/types/asdp'
import { userRoles } from '../../shared/types/asdp'
import { bodyObject, enumValue, requiredText } from '../utils/http-input'

export const userPayload = (value: unknown): CreateUserInput => {
  const body = bodyObject(value)
  const email = requiredText(body.email, 'email').toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'email must be a valid email address' })
  }
  return {
    name: requiredText(body.name, 'name'),
    email,
    role: enumValue(body.role, userRoles, 'member'),
  }
}

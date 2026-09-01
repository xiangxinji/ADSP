import { createError } from 'h3'
import type { CreateUserInput, UpdateUserPasswordInput } from '../../shared/types/asdp'
import { userRoles } from '../../shared/types/asdp'
import { bodyObject, enumValue, requiredText } from '../utils/http-input'

const passwordValue = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'password is required' })
  }
  if (value.length < 8 || value.length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'password must be between 8 and 128 characters' })
  }
  return value
}

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
    password: passwordValue(body.password),
  }
}

export const userPasswordPayload = (value: unknown): UpdateUserPasswordInput => {
  const body = bodyObject(value)
  return { password: passwordValue(body.password) }
}

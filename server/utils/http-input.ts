import { createError, getRouterParam, type H3Event } from 'h3'

export const routeParameter = (event: H3Event, name = 'id') => {
  const value = getRouterParam(event, name)?.trim()
  if (!value) throw createError({ statusCode: 400, statusMessage: `${name} route parameter is required` })
  return value
}

export const bodyObject = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Request body must be a JSON object' })
  }

  return value as Record<string, unknown>
}

export const requiredText = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw createError({ statusCode: 400, statusMessage: `${field} is required` })
  }

  return value.trim()
}

export const optionalText = (value: unknown, fallback = '') => {
  if (value === undefined) return fallback
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Expected a string value' })
  }

  return value.trim()
}

export const optionalStringArray = (value: unknown, fallback: string[] = []) => {
  if (value === undefined) return fallback
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'Expected an array of IDs' })
  }

  return [...new Set(value)]
}

export const enumValue = <T extends string>(value: unknown, allowed: readonly T[], fallback: T) => {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw createError({ statusCode: 400, statusMessage: `Allowed values: ${allowed.join(', ')}` })
  }

  return value as T
}

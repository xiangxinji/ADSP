import { createError } from 'h3'

export const requireEntity = <T>(entity: T | undefined, statusMessage: string): T => {
  if (!entity) throw createError({ statusCode: 404, statusMessage })
  return entity
}

export const badRequest = (statusMessage: string) => createError({ statusCode: 400, statusMessage })

export const conflict = (statusMessage: string, cause?: unknown) => createError({
  statusCode: 409,
  statusMessage,
  cause,
})

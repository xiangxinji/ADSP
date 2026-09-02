import { createError } from 'h3'

export const createAssetOperationError = (
  statusCode: number,
  code: string,
  statusMessage: string,
  cause?: unknown,
) => createError({
  statusCode,
  statusMessage,
  data: { code },
  cause,
})

export const assetOperationErrorCode = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('data' in error)) return null
  const data = error.data
  if (!data || typeof data !== 'object' || !('code' in data)) return null
  return typeof data.code === 'string' ? data.code : null
}

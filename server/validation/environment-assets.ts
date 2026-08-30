import { createError } from 'h3'
import type { CreateEnvironmentInput, UpdateEnvironmentInput } from '../../shared/types/asdp'
import { environmentTypes } from '../../shared/types/asdp'
import { bodyObject, requiredText } from '../utils/http-input'

const environmentAddress = (value: unknown) => {
  const address = requiredText(value, 'address')
  if (address.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'address must be 500 characters or fewer' })
  }

  let url: URL
  try {
    url = new URL(address)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'address must be a valid URL' })
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'address must use HTTP or HTTPS and cannot include credentials',
    })
  }
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

const environmentType = (value: unknown) => {
  const type = requiredText(value, 'type')
  if (!environmentTypes.includes(type as typeof environmentTypes[number])) {
    throw createError({
      statusCode: 400,
      statusMessage: `Allowed environment types: ${environmentTypes.join(', ')}`,
    })
  }
  return type as typeof environmentTypes[number]
}

const environmentAccounts = (value: unknown) => {
  if (!Array.isArray(value) || value.some(account => typeof account !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'accounts must be an array of account names' })
  }
  const accounts = [...new Set(value.map(account => account.trim()).filter(Boolean))]
  if (accounts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'at least one account is required' })
  }
  if (accounts.length > 20 || accounts.some(account => account.length > 100)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'accounts allow up to 20 values of 100 characters each',
    })
  }
  return accounts
}

export const environmentPayload = (
  value: unknown,
  partial = false,
): CreateEnvironmentInput | UpdateEnvironmentInput => {
  const body = bodyObject(value)
  return {
    address: partial && body.address === undefined ? undefined : environmentAddress(body.address),
    type: partial && body.type === undefined ? undefined : environmentType(body.type),
    accounts: partial && body.accounts === undefined ? undefined : environmentAccounts(body.accounts),
  }
}

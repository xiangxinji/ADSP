import { createError } from 'h3'
import type { CreateEnvironmentInput, UpdateEnvironmentInput } from '../../shared/types/asdp'
import { environmentTypes } from '../../shared/types/asdp'
import { bodyObject, optionalText, requiredText } from '../utils/http-input'

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
  if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw createError({ statusCode: 400, statusMessage: 'accounts must be an array of account and password objects' })
  }
  const accounts = value.map((item) => {
    const entry = item as Record<string, unknown>
    const account = typeof entry.account === 'string' ? entry.account.trim() : ''
    const password = typeof entry.password === 'string' ? entry.password : ''
    if (!account) {
      throw createError({ statusCode: 400, statusMessage: 'each environment account requires an account name' })
    }
    if (account.length > 100 || password.length > 500) {
      throw createError({
        statusCode: 400,
        statusMessage: 'account names allow up to 100 characters and passwords up to 500 characters',
      })
    }
    return { account, password }
  })
  if (accounts.length > 20) {
    throw createError({
      statusCode: 400,
      statusMessage: 'accounts allow up to 20 values',
    })
  }
  if (new Set(accounts.map(account => account.account)).size !== accounts.length) {
    throw createError({ statusCode: 400, statusMessage: 'environment account names must be unique' })
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
    note: partial && body.note === undefined ? undefined : optionalText(body.note),
    type: partial && body.type === undefined ? undefined : environmentType(body.type),
    accounts: partial && body.accounts === undefined ? undefined : environmentAccounts(body.accounts),
  }
}

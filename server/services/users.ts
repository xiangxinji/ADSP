import { randomUUID } from 'node:crypto'
import type { CreateUserInput, UserAccount } from '../../shared/types/asdp'
import { findUser, insertUser, listUserAccounts } from '../repositories/users'
import { conflict, requireEntity } from './errors'

export const listUsers = () => listUserAccounts()

export const getUser = (id: string) => requireEntity(findUser(id), 'User not found')

export const createUser = (input: CreateUserInput) => {
  const timestamp = new Date().toISOString()
  const user: UserAccount = {
    id: randomUUID(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  try {
    insertUser(user)
  } catch (error) {
    throw conflict('This email is already registered', error)
  }
  return getUser(user.id)
}

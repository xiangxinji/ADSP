import { randomUUID } from 'node:crypto'
import type { CreateUserInput, ManagedUserAccount, UserAccount } from '../../shared/types/asdp'
import { findUser, insertUser, listUserAccounts, updateUserPasswordHash } from '../repositories/users'
import { hashPassword } from '../utils/password'
import { conflict, requireEntity } from './errors'

export const listUsers = () => listUserAccounts()

export const getUser = (id: string) => requireEntity(findUser(id), 'User not found')

export const createUser = async (input: CreateUserInput): Promise<ManagedUserAccount> => {
  const timestamp = new Date().toISOString()
  const { password, ...profile } = input
  const user: UserAccount = {
    id: randomUUID(),
    ...profile,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const passwordHash = await hashPassword(password)
  try {
    insertUser(user, passwordHash)
  } catch (error) {
    throw conflict('This email is already registered', error)
  }
  return { ...getUser(user.id), hasPassword: true }
}

export const updateUserPassword = async (id: string, password: string): Promise<ManagedUserAccount> => {
  getUser(id)
  const passwordHash = await hashPassword(password)
  updateUserPasswordHash(id, passwordHash, new Date().toISOString())
  return { ...getUser(id), hasPassword: true }
}

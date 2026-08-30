import { randomUUID } from 'node:crypto'
import type {
  CreateEnvironmentInput,
  EnvironmentAsset,
  UpdateEnvironmentInput,
} from '../../shared/types/asdp'
import {
  findEnvironmentAsset,
  insertEnvironmentAsset,
  listEnvironmentAssets,
  removeEnvironmentAsset,
  replaceEnvironmentAccounts,
  updateEnvironmentAssetRecord,
} from '../repositories/environment-assets'
import { runInTransaction } from '../repositories/unit-of-work'
import { conflict, requireEntity } from './errors'
import { getProject } from './projects'

export const getEnvironment = (id: string) => requireEntity(
  findEnvironmentAsset(id),
  'Environment not found',
)

export const listProjectEnvironments = (projectId: string) => listEnvironmentAssets(projectId)

export const createEnvironment = (projectId: string, input: CreateEnvironmentInput) => {
  getProject(projectId)
  const timestamp = new Date().toISOString()
  const environment: EnvironmentAsset = {
    id: randomUUID(),
    projectId,
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  try {
    runInTransaction(() => {
      insertEnvironmentAsset(environment)
      replaceEnvironmentAccounts(environment.id, environment.accounts)
    })
  } catch (error) {
    throw conflict('This environment address is already registered in the project', error)
  }
  return getEnvironment(environment.id)
}

export const updateEnvironment = (id: string, input: UpdateEnvironmentInput) => {
  const current = getEnvironment(id)
  const environment: EnvironmentAsset = {
    ...current,
    address: input.address ?? current.address,
    type: input.type ?? current.type,
    accounts: input.accounts ?? current.accounts,
    updatedAt: new Date().toISOString(),
  }
  try {
    runInTransaction(() => {
      updateEnvironmentAssetRecord(environment)
      replaceEnvironmentAccounts(id, environment.accounts)
    })
  } catch (error) {
    throw conflict('This environment address is already registered in the project', error)
  }
  return getEnvironment(id)
}

export const deleteEnvironment = (id: string) => {
  getEnvironment(id)
  removeEnvironmentAsset(id)
}

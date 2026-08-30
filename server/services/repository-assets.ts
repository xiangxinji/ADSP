import { randomUUID } from 'node:crypto'
import type {
  CreateRepositoryInput,
  RepositoryAsset,
  UpdateRepositoryInput,
} from '../../shared/types/asdp'
import {
  findRepositoryAsset,
  insertRepositoryAsset,
  listRepositoryAssets,
  removeRepositoryAsset,
  updateRepositoryAssetRecord,
} from '../repositories/repository-assets'
import { getProject } from './projects'
import { conflict, requireEntity } from './errors'

export const getRepository = (id: string) => requireEntity(findRepositoryAsset(id), 'Repository not found')

export const listProjectRepositories = (projectId: string) => listRepositoryAssets(projectId)

export const createRepository = (projectId: string, input: CreateRepositoryInput) => {
  getProject(projectId)
  const timestamp = new Date().toISOString()
  const repository: RepositoryAsset = {
    id: randomUUID(),
    projectId,
    provider: input.provider,
    externalId: input.externalId || null,
    name: input.name,
    note: input.note || '',
    url: input.url,
    defaultBranch: input.defaultBranch,
    referenceCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  try {
    insertRepositoryAsset(repository)
  } catch (error) {
    throw conflict('This repository URL is already registered in the project', error)
  }
  return getRepository(repository.id)
}

export const updateRepository = (id: string, input: UpdateRepositoryInput) => {
  const current = getRepository(id)
  const repository: RepositoryAsset = {
    ...current,
    provider: input.provider ?? current.provider,
    externalId: input.externalId === undefined ? current.externalId : input.externalId,
    name: input.name ?? current.name,
    note: input.note ?? current.note,
    url: input.url ?? current.url,
    defaultBranch: input.defaultBranch ?? current.defaultBranch,
    updatedAt: new Date().toISOString(),
  }
  try {
    updateRepositoryAssetRecord(repository)
  } catch (error) {
    throw conflict('This repository URL is already registered in the project', error)
  }
  return getRepository(id)
}

export const deleteRepository = (id: string) => {
  getRepository(id)
  removeRepositoryAsset(id)
}

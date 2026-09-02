import { randomUUID } from 'node:crypto'
import type {
  CreateRepositoryInput,
  RepositoryAsset,
  RepositoryLocalOperation,
  UpdateRepositoryInput,
} from '../../shared/types/asdp'
import {
  findRepositoryAsset,
  insertRepositoryAsset,
  listRepositoryAssets,
  removeRepositoryAsset,
  updateRepositoryAssetRecord,
  updateRepositoryLocalOperationRecord,
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
    branchStrategy: input.branchStrategy || 'multi-version',
    externalId: input.externalId || null,
    name: input.name,
    note: input.note || '',
    url: input.url,
    localOperation: null,
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
    branchStrategy: input.branchStrategy ?? current.branchStrategy,
    externalId: input.externalId === undefined ? current.externalId : input.externalId,
    name: input.name ?? current.name,
    note: input.note ?? current.note,
    url: input.url ?? current.url,
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

export const startRepositoryLocalOperation = (id: string, operationId: string) => {
  const repository = getRepository(id)
  if (repository.localOperation?.status === 'running') {
    throw conflict(`仓库本地操作正在进行：${repository.localOperation.operationId}`)
  }
  const operation: RepositoryLocalOperation = {
    operationId,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  }
  updateRepositoryLocalOperationRecord(id, operation)
  return operation
}

export const finishRepositoryLocalOperation = (
  id: string,
  operation: RepositoryLocalOperation,
  status: 'succeeded' | 'failed',
  error: string | null = null,
) => {
  updateRepositoryLocalOperationRecord(id, {
    ...operation,
    status,
    finishedAt: new Date().toISOString(),
    error,
  })
}

import { createError } from 'h3'
import { findAssetOperation } from '../../shared/config/asset-operations'
import type { AssetType } from '../../shared/types/asset-operations'
import type {
  CreateRepositoryBranchInput,
  CreateRepositoryWorktreeInput,
  RepositoryBranchResult,
  RepositoryCloneResult,
  RepositoryLocalCloneStatusResult,
  RepositoryUpdateResult,
  RepositoryWorktreeResult,
} from '../../shared/types/asdp'
import { createRepositoryBranch } from './repository-branch-creation'
import {
  cloneRepository,
  createRepositoryWorktree,
  getRepositoryLocalCloneStatus,
  updateRepositoryWorkingCopy,
} from './repository-cloning'
import {
  finishRepositoryLocalOperation,
  startRepositoryLocalOperation,
} from './repository-assets'
import {
  assetOperationErrorCode,
  createAssetOperationError,
} from '../utils/asset-operation-error'

type AssetOperationResult =
  | RepositoryBranchResult
  | RepositoryCloneResult
  | RepositoryLocalCloneStatusResult
  | RepositoryUpdateResult
  | RepositoryWorktreeResult
type AssetOperationInput = CreateRepositoryBranchInput | CreateRepositoryWorktreeInput
type AssetOperationHandler = (
  assetId: string,
  input?: AssetOperationInput,
) => Promise<AssetOperationResult>

const localRepositoryOperationIds = new Set([
  'repository.clone',
  'repository.update',
  'repository.local-clone-status',
  'repository.create-worktree',
])

const localOperationError = (error: unknown) => {
  if (error && typeof error === 'object' && 'statusMessage' in error) {
    return String(error.statusMessage)
  }
  if (error instanceof Error) return error.message
  return '本地操作执行失败'
}

const normalizedOperationError = (error: unknown) => {
  if (assetOperationErrorCode(error)) return error

  const statusCode = error && typeof error === 'object' && 'statusCode' in error
    ? Number(error.statusCode)
    : 500
  const statusMessage = localOperationError(error)
  if (statusMessage === '请先在全局设置中配置本地工作空间') {
    return createAssetOperationError(409, 'repository.workspace-not-configured', statusMessage)
  }
  return createAssetOperationError(
    Number.isInteger(statusCode) ? statusCode : 500,
    'repository.local-operation-failed',
    statusMessage,
    error,
  )
}

const operationHandlers = {
  'repository.clone': (assetId: string) => cloneRepository(assetId),
  'repository.update': (assetId: string) => updateRepositoryWorkingCopy(assetId),
  'repository.local-clone-status': (assetId: string) => getRepositoryLocalCloneStatus(assetId),
  'repository.create-worktree': (assetId: string, input?: AssetOperationInput) => {
    if (!input) {
      throw createAssetOperationError(400, 'repository.worktree-branch-required', '创建工作树需要指定 branch')
    }
    return createRepositoryWorktree(assetId, input.branch)
  },
  'repository.create-branch': (assetId: string, input?: AssetOperationInput) => {
    if (!input || !('source' in input)) {
      throw createAssetOperationError(400, 'repository.source-required', '创建远程分支需要指定 source')
    }
    return createRepositoryBranch(assetId, input)
  },
} satisfies Record<string, AssetOperationHandler>

export const executeAssetOperation = async (
  assetType: AssetType,
  assetId: string,
  operationId: string,
  input?: CreateRepositoryBranchInput | CreateRepositoryWorktreeInput,
): Promise<AssetOperationResult> => {
  const operation = findAssetOperation(assetType, operationId)
  if (!operation || operation.execution.kind !== 'command') {
    throw createError({ statusCode: 404, statusMessage: '资产操作不存在或不能由服务端执行' })
  }

  const handler = operationHandlers[operation.execution.command]
  if (!handler) {
    throw createError({ statusCode: 501, statusMessage: '资产操作尚未接入执行器' })
  }

  const localOperation = localRepositoryOperationIds.has(operation.id)
    ? startRepositoryLocalOperation(assetId, operation.id)
    : null
  try {
    const result = await handler(assetId, input)
    if (localOperation) finishRepositoryLocalOperation(assetId, localOperation, 'succeeded')
    return result
  } catch (error) {
    const operationError = assetOperationErrorCode(error)
      ? error
      : localOperation
        ? normalizedOperationError(error)
        : createAssetOperationError(
            500,
            'repository.remote-operation-failed',
            localOperationError(error),
            error,
          )
    if (localOperation) {
      finishRepositoryLocalOperation(assetId, localOperation, 'failed', localOperationError(operationError))
    }
    throw operationError
  }
}

export const executeRepositoryCloneOperation = (assetId: string) =>
  executeAssetOperation('repository', assetId, 'repository.clone') as Promise<RepositoryCloneResult>

export const executeRepositoryUpdateOperation = (assetId: string) =>
  executeAssetOperation('repository', assetId, 'repository.update') as Promise<RepositoryUpdateResult>

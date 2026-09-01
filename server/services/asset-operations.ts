import { createError } from 'h3'
import { findAssetOperation } from '../../shared/config/asset-operations'
import type { AssetType } from '../../shared/types/asset-operations'
import type { RepositoryCloneResult, RepositoryUpdateResult } from '../../shared/types/asdp'
import { cloneRepository, updateRepositoryWorkingCopy } from './repository-cloning'

type AssetOperationResult = RepositoryCloneResult | RepositoryUpdateResult
type AssetOperationHandler = (assetId: string) => Promise<AssetOperationResult>

const operationHandlers = {
  'repository.clone': cloneRepository,
  'repository.update': updateRepositoryWorkingCopy,
} satisfies Record<string, AssetOperationHandler>

export const executeAssetOperation = async (
  assetType: AssetType,
  assetId: string,
  operationId: string,
): Promise<AssetOperationResult> => {
  const operation = findAssetOperation(assetType, operationId)
  if (!operation || operation.execution.kind !== 'command') {
    throw createError({ statusCode: 404, statusMessage: '资产操作不存在或不能由服务端执行' })
  }

  const handler = operationHandlers[operation.execution.command]
  if (!handler) {
    throw createError({ statusCode: 501, statusMessage: '资产操作尚未接入执行器' })
  }

  return handler(assetId)
}

export const executeRepositoryCloneOperation = (assetId: string) =>
  executeAssetOperation('repository', assetId, 'repository.clone') as Promise<RepositoryCloneResult>

export const executeRepositoryUpdateOperation = (assetId: string) =>
  executeAssetOperation('repository', assetId, 'repository.update') as Promise<RepositoryUpdateResult>

import { findAssetOperation, isProjectAssetOperation } from '../../shared/config/asset-operations'
import type { AssetType } from '../../shared/types/asset-operations'
import type { AssetListResult } from '../../shared/types/asset-lists'
import { assetOperationErrorCode, createAssetOperationError } from '../utils/asset-operation-error'
import { projectAssetOperationInput } from '../validation/project-asset-operations'
import { listProjectEnvironments } from './environment-assets'
import { listProjectKnowledge } from './knowledge-assets'
import { listMembersForProject } from './project-members'
import { getProject } from './projects'
import { listProjectRepositories } from './repository-assets'

const listHandlers: Partial<Record<AssetType, (projectId: string) => AssetListResult>> = {
  repository: listProjectRepositories,
  member: listMembersForProject,
  environment: listProjectEnvironments,
  knowledge: listProjectKnowledge,
}

export const executeProjectAssetOperation = (
  projectId: string, assetType: AssetType, operationId: string, input?: unknown,
): AssetListResult => {
  const operation = findAssetOperation(assetType, operationId)
  const handler = listHandlers[assetType]
  if (!isProjectAssetOperation(operation) || !handler || operation.execution.command !== `${assetType}.list`) {
    throw createAssetOperationError(404, 'asset.operation-not-found', '当前资产类型不支持此项目级操作。')
  }
  projectAssetOperationInput(input)
  try {
    try {
      getProject(projectId)
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        throw createAssetOperationError(404, 'asset.project-not-found', '当前项目不存在。')
      }
      throw error
    }
    return handler(projectId)
  } catch (error) {
    if (assetOperationErrorCode(error)) throw error
    throw createAssetOperationError(500, 'asset.list-failed', '读取项目资产失败，请检查服务日志。', error)
  }
}

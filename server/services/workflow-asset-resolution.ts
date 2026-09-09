import type { AssetType } from '../../shared/types/asset-operations'
import { createAssetOperationError } from '../utils/asset-operation-error'
import { getEnvironment } from './environment-assets'
import { getKnowledge } from './knowledge-assets'
import { getProjectMember } from './project-members'
import { getRepository } from './repository-assets'

export const workflowAssetProjectId = (assetType: AssetType, assetId: string) => {
  if (assetType === 'repository') return getRepository(assetId, 'repository.not-found').projectId
  if (assetType === 'member') return getProjectMember(assetId).projectId
  if (assetType === 'environment') return getEnvironment(assetId).projectId
  return getKnowledge(assetId).projectId
}

export const resolveWorkflowAssetId = (projectId: string, assetType: AssetType, input: string | boolean | undefined) => {
  if (typeof input !== 'string' || !input.trim()) {
    throw createAssetOperationError(422, 'workflow.asset-input-invalid', '资产 ID 必须是非空字符串。')
  }
  const assetId = input.trim()
  if (workflowAssetProjectId(assetType, assetId) !== projectId) {
    throw createAssetOperationError(422, 'workflow.asset-project-mismatch', '输入资产不属于当前工作流项目。')
  }
  return assetId
}

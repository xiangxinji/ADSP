import { createAssetOperationError } from '../utils/asset-operation-error'
import { getStoredGitLabCredentials } from './gitlab'
import { getRepository } from './repository-assets'

export const getGitLabRepositoryOperationContext = (repositoryId: string) => {
  const repository = getRepository(repositoryId, 'repository.not-found')
  if (repository.provider !== 'gitlab') {
    throw createAssetOperationError(
      409,
      'repository.provider-unsupported',
      `暂不支持通过 ${repository.provider} API 执行此仓库操作`,
    )
  }
  if (!repository.externalId) {
    throw createAssetOperationError(
      409,
      'repository.external-id-required',
      '仓库资产缺少 GitLab 项目 ID，请重新从 GitLab 选择仓库',
    )
  }

  let credentials
  try {
    credentials = getStoredGitLabCredentials()
  } catch (error) {
    throw createAssetOperationError(
      500,
      'repository.gitlab-credentials-unavailable',
      '已保存的 GitLab 凭据无法使用，请重新配置 GitLab 连接',
      error,
    )
  }
  if (!credentials) {
    throw createAssetOperationError(409, 'repository.gitlab-not-configured', '请先在全局设置中配置 GitLab')
  }

  return { credentials, repositoryExternalId: repository.externalId }
}

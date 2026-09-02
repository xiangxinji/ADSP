import type {
  CreateRepositoryBranchInput,
  RepositoryBranchResult,
} from '../../shared/types/asdp'
import { createGitLabRepositoryBranch } from '../integrations/gitlab'
import { createAssetOperationError } from '../utils/asset-operation-error'
import { getStoredGitLabCredentials } from './gitlab'
import { getRepository } from './repository-assets'

export const createRepositoryBranch = async (
  repositoryId: string,
  input: CreateRepositoryBranchInput,
): Promise<RepositoryBranchResult> => {
  const repository = getRepository(repositoryId, 'repository.not-found')
  if (repository.provider !== 'gitlab') {
    throw createAssetOperationError(
      409,
      'repository.provider-unsupported',
      `暂不支持通过 ${repository.provider} API 创建远程分支`,
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

  await createGitLabRepositoryBranch(credentials, repository.externalId, input)
  return { repositoryId, branch: input.branch, source: input.source }
}

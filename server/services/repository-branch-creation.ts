import type {
  CreateRepositoryBranchInput,
  RepositoryBranchResult,
} from '../../shared/types/asdp'
import { createGitLabRepositoryBranch } from '../integrations/gitlab'
import { getGitLabRepositoryOperationContext } from './repository-provider-operation'

export const createRepositoryBranch = async (
  repositoryId: string,
  input: CreateRepositoryBranchInput,
): Promise<RepositoryBranchResult> => {
  const context = getGitLabRepositoryOperationContext(repositoryId)
  await createGitLabRepositoryBranch(context.credentials, context.repositoryExternalId, input)
  return { repositoryId, branch: input.branch, source: input.source }
}

import type {
  CreateRepositoryMergeRequestInput,
  RepositoryMergeRequestResult,
} from '../../shared/types/asdp'
import { createGitLabMergeRequest } from '../integrations/gitlab'
import { getGitLabRepositoryOperationContext } from './repository-provider-operation'

export const createRepositoryMergeRequest = async (
  repositoryId: string,
  input: CreateRepositoryMergeRequestInput,
): Promise<RepositoryMergeRequestResult> => {
  const context = getGitLabRepositoryOperationContext(repositoryId)
  const mergeRequest = await createGitLabMergeRequest(
    context.credentials,
    context.repositoryExternalId,
    input,
  )
  return { repositoryId, ...mergeRequest }
}

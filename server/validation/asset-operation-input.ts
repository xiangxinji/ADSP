import {
  repositoryCreateBranchPayload,
  repositoryCreateMergeRequestPayload,
  repositoryWorktreePayload,
} from './repository-assets'

export const assetOperationInput = (operationId: string, body: unknown) => {
  if (operationId === 'repository.create-worktree') return repositoryWorktreePayload(body)
  if (operationId === 'repository.create-branch') return repositoryCreateBranchPayload(body)
  if (operationId === 'repository.create-merge-request') return repositoryCreateMergeRequestPayload(body)
  return undefined
}

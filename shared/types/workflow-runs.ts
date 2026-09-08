import type {
  RepositoryBranchResult,
  RepositoryCloneResult,
  RepositoryLocalCloneStatusResult,
  RepositoryMergeRequestResult,
  RepositoryUpdateResult,
  RepositoryWorktreeResult,
  WorkflowDefinition,
} from './asdp'

export type WorkflowRunStatus = 'running' | 'succeeded' | 'failed'
export type WorkflowStepStatus = WorkflowRunStatus | 'pending' | 'skipped'

export type WorkflowRunStep = {
  nodeId: string
  status: WorkflowStepStatus
  startedAt: string | null
  finishedAt: string | null
  output: RepositoryBranchResult | RepositoryCloneResult | RepositoryLocalCloneStatusResult
    | RepositoryMergeRequestResult | RepositoryUpdateResult | RepositoryWorktreeResult | null
  error: { code: string, message: string } | null
}

export type WorkflowRun = {
  id: string
  workflowId: string
  workflow: WorkflowDefinition
  status: WorkflowRunStatus
  steps: WorkflowRunStep[]
  startedAt: string
  finishedAt: string | null
}

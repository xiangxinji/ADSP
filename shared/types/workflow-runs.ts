import type {
  RepositoryBranchResult,
  RepositoryCloneResult,
  RepositoryLocalCloneStatusResult,
  RepositoryMergeRequestResult,
  RepositoryUpdateResult,
  RepositoryWorktreeResult,
  WorkflowDefinition,
  WorkflowOperationResolvedInputs,
  WorkflowValueObject,
} from './asdp'

export type WorkflowRunStatus = 'running' | 'succeeded' | 'failed'
export type WorkflowStepStatus = WorkflowRunStatus | 'pending' | 'skipped'

export type WorkflowRunError = { code: string, message: string }

export type WorkflowAsyncBranchResult = {
  portId: string
  nodeId: string
  status: 'succeeded' | 'failed'
  failedNodeId: string | null
  error: WorkflowRunError | null
}

export type WorkflowAsyncOutput = {
  branches: WorkflowAsyncBranchResult[]
  selectedPort: 'complete' | 'error'
}

export type WorkflowRunStep = {
  nodeId: string
  status: WorkflowStepStatus
  startedAt: string | null
  finishedAt: string | null
  resolvedInputs: WorkflowOperationResolvedInputs | null
  output: RepositoryBranchResult | RepositoryCloneResult | RepositoryLocalCloneStatusResult
    | RepositoryMergeRequestResult | RepositoryUpdateResult | RepositoryWorktreeResult | WorkflowAsyncOutput | null
  error: WorkflowRunError | null
}

export type WorkflowRun = {
  id: string
  workflowId: string
  workflow: WorkflowDefinition
  root: WorkflowValueObject
  status: WorkflowRunStatus
  steps: WorkflowRunStep[]
  startedAt: string
  finishedAt: string | null
}

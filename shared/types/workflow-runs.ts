import type {
  RepositoryBranchResult,
  RepositoryCloneResult,
  RepositoryLocalCloneStatusResult,
  RepositoryMergeRequestResult,
  RepositoryUpdateResult,
  RepositoryWorktreeResult,
  WorkflowDefinition,
  WorkflowOperationResolvedInputs,
  WorkflowValue,
  WorkflowValueObject,
} from './asdp'

import type { AssetListResult } from './asset-lists'

export type WorkflowRunStatus = 'running' | 'succeeded' | 'failed'
export type WorkflowStepStatus = WorkflowRunStatus | 'pending' | 'skipped' | 'handled'

export type WorkflowRunError = { code: string, message: string }

export type WorkflowBranchResult = {
  portId: string
  nodeId: string
  status: 'succeeded' | 'failed' | 'skipped'
  failedNodeId: string | null
  error: WorkflowRunError | null
  index?: number
  input?: WorkflowValue
}

export type WorkflowAsyncBranchResult = WorkflowBranchResult & { status: 'succeeded' | 'failed' }

export type WorkflowControlOutput = {
  branches: WorkflowBranchResult[]
  selectedPort: 'complete' | 'error'
}

export type WorkflowAsyncOutput = WorkflowControlOutput & { branches: WorkflowAsyncBranchResult[] }
export type WorkflowSyncOutput = WorkflowControlOutput

export type WorkflowStepExecution = {
  nodeId: string
  status: WorkflowStepStatus
  startedAt: string | null
  finishedAt: string | null
  resolvedInputs: WorkflowOperationResolvedInputs | null
  output: RepositoryBranchResult | RepositoryCloneResult | RepositoryLocalCloneStatusResult
    | RepositoryMergeRequestResult | RepositoryUpdateResult | RepositoryWorktreeResult | WorkflowControlOutput | AssetListResult | null
  error: WorkflowRunError | null
}

export type WorkflowIterationStep = WorkflowStepExecution & {
  iterationPath: { nodeId: string, index: number }[]
}

export type WorkflowRunStep = WorkflowStepExecution & {
  executions?: WorkflowIterationStep[]
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

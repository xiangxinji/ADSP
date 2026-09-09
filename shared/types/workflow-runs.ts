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
    | RepositoryMergeRequestResult | RepositoryUpdateResult | RepositoryWorktreeResult | WorkflowControlOutput | AssetListResult | WorkflowValue | null
  error: WorkflowRunError | null
  childRun?: WorkflowRun
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
  root: WorkflowValue
  output?: WorkflowValue
  referencedWorkflowIds?: string[]
  status: WorkflowRunStatus
  steps: WorkflowRunStep[]
  startedAt: string
  finishedAt: string | null
}

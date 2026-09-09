import type { WorkflowRun, WorkflowRunStep, WorkflowStepExecution, WorkflowIterationStep } from '../../shared/types/workflow-runs'
import { updateWorkflowRun } from '../repositories/workflow-runs'

export type WorkflowExecutionScope = {
  path: WorkflowIterationStep['iterationPath']
  steps: Map<string, WorkflowStepExecution>
}

export const createWorkflowExecutionContext = (run: WorkflowRun) => {
  const summaries = new Map(run.steps.map(step => [step.nodeId, step]))
  const rootScope: WorkflowExecutionScope = { path: [], steps: summaries }
  const iterationScope = (parent: WorkflowExecutionScope, nodeId: string, index: number): WorkflowExecutionScope => ({
    path: [...parent.path, { nodeId, index }], steps: new Map(),
  })
  const getStep = (nodeId: string, scope: WorkflowExecutionScope): WorkflowStepExecution => {
    const existing = scope.steps.get(nodeId)
    if (existing) return existing
    const step: WorkflowIterationStep = {
      nodeId, iterationPath: scope.path, status: 'pending', startedAt: null, finishedAt: null,
      resolvedInputs: null, output: null, error: null,
    }
    scope.steps.set(nodeId, step)
    const summary = summaries.get(nodeId)!
    summary.executions ||= []
    summary.executions.push(step)
    return step
  }
  const summarize = (summary: WorkflowRunStep) => {
    const executions = summary.executions
    if (!executions?.length) return
    summary.status = executions.some(step => step.status === 'running') ? 'running'
      : executions.some(step => step.status === 'failed') ? 'failed'
        : executions.some(step => step.status === 'pending') ? 'pending'
          : executions.some(step => step.status === 'succeeded') ? 'succeeded' : 'skipped'
    summary.startedAt = executions.flatMap(step => step.startedAt ? [step.startedAt] : []).sort()[0] || null
    summary.finishedAt = executions.every(step => step.finishedAt)
      ? executions.map(step => step.finishedAt!).sort().at(-1)! : null
    summary.error = executions.find(step => step.error)?.error || null
    summary.resolvedInputs = executions.length === 1 ? executions[0]!.resolvedInputs : null
    summary.output = executions.length === 1 ? executions[0]!.output : null
  }
  const persist = () => {
    run.steps.forEach(summarize)
    updateWorkflowRun(run)
  }
  return { rootScope, iterationScope, getStep, persist }
}

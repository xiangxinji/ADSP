import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type { WorkflowDefinition, WorkflowValue } from '../../shared/types/asdp'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { listActiveWorkflowRuns, updateWorkflowRun } from '../repositories/workflow-runs'

export const createWorkflowRun = (workflow: WorkflowDefinition, root: WorkflowValue): WorkflowRun => ({
  id: randomUUID(), workflowId: workflow.id, workflow: structuredClone(workflow), root: structuredClone(root),
  status: 'running', startedAt: new Date().toISOString(), finishedAt: null,
  steps: workflow.nodes.map(node => ({
    nodeId: node.id, status: 'pending', startedAt: null, finishedAt: null, resolvedInputs: null, output: null, error: null,
  })),
})

export const assertWorkflowIdle = (workflowId: string) => {
  if (listActiveWorkflowRuns().some(run => run.workflowId === workflowId || run.referencedWorkflowIds?.includes(workflowId))) {
    throw createError({ statusCode: 409, statusMessage: '工作流正在运行，请等待本次执行完成', data: { code: 'workflow.already-running' } })
  }
}

export const assertProjectWorkflowsIdle = (projectId: string) => {
  if (listActiveWorkflowRuns().some(run => run.workflow.projectId === projectId)) {
    throw createError({ statusCode: 409, statusMessage: '项目中有正在运行的工作流，暂时不能删除', data: { code: 'workflow.already-running' } })
  }
}

export const recoverInterruptedWorkflowRuns = () => {
  const recover = (run: WorkflowRun) => {
    if (run.status !== 'running') return
    run.status = 'failed'
    run.finishedAt = new Date().toISOString()
    for (const step of run.steps.flatMap(step => [step, ...(step.executions || [])])) {
      if (step.childRun) recover(step.childRun)
      if (step.status === 'running' || step.status === 'pending') {
        step.error = { code: 'workflow.interrupted', message: '服务重启导致执行中断，请核实外部操作结果后再运行，系统不会自动重试。' }
        step.status = step.status === 'running' ? 'failed' : 'skipped'
        step.finishedAt = run.finishedAt
      }
    }
  }
  for (const run of listActiveWorkflowRuns()) {
    recover(run)
    updateWorkflowRun(run)
  }
}

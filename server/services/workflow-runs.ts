import { createError } from 'h3'
import { listActiveWorkflowRuns, updateWorkflowRun } from '../repositories/workflow-runs'

export const assertWorkflowIdle = (workflowId: string) => {
  if (listActiveWorkflowRuns().some(run => run.workflowId === workflowId)) {
    throw createError({ statusCode: 409, statusMessage: '工作流正在运行，请等待本次执行完成', data: { code: 'workflow.already-running' } })
  }
}

export const assertProjectWorkflowsIdle = (projectId: string) => {
  if (listActiveWorkflowRuns().some(run => run.workflow.projectId === projectId)) {
    throw createError({ statusCode: 409, statusMessage: '项目中有正在运行的工作流，暂时不能删除', data: { code: 'workflow.already-running' } })
  }
}

export const recoverInterruptedWorkflowRuns = () => {
  for (const run of listActiveWorkflowRuns()) {
    run.status = 'failed'
    run.finishedAt = new Date().toISOString()
    for (const step of run.steps) {
      if (step.status === 'running' || step.status === 'pending') {
        step.error = { code: 'workflow.interrupted', message: '服务重启导致执行中断，请核实外部操作结果后再运行，系统不会自动重试。' }
        step.status = step.status === 'running' ? 'failed' : 'skipped'
        step.finishedAt = run.finishedAt
      }
    }
    updateWorkflowRun(run)
  }
}

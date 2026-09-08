import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { insertWorkflowRun, listWorkflowRuns, updateWorkflowRun } from '../repositories/workflow-runs'
import { runInTransaction } from '../repositories/unit-of-work'
import { assetOperationErrorCode } from '../utils/asset-operation-error'
import { assetOperationInput } from '../validation/asset-operation-input'
import { executeAssetOperation } from './asset-operations'
import { getWorkflow, validateWorkflowForExecution } from './workflow-definitions'
import { assertWorkflowIdle } from './workflow-runs'

export const getWorkflowRuns = (workflowId: string) => {
  getWorkflow(workflowId)
  return listWorkflowRuns(workflowId)
}

const executeRun = async (run: WorkflowRun, inputs: ReturnType<typeof assetOperationInput>[]) => {
  for (const [index, node] of run.workflow.nodes.entries()) {
    const step = run.steps[index]
    step.status = 'running'
    step.startedAt = new Date().toISOString()
    updateWorkflowRun(run)
    try {
      step.output = await executeAssetOperation(node.assetType, node.assetId, node.operationId, inputs[index])
      step.status = 'succeeded'
    } catch (error) {
      const code = assetOperationErrorCode(error)
      step.status = 'failed'
      step.error = {
        code: code || 'workflow.operation-failed',
        message: code && error && typeof error === 'object' && 'statusMessage' in error
          ? String(error.statusMessage)
          : '节点执行失败，请检查服务日志和资产状态。',
      }
      run.status = 'failed'
    }
    step.finishedAt = new Date().toISOString()
    if (run.status === 'failed') {
      for (const remaining of run.steps.slice(index + 1)) {
        remaining.status = 'skipped'
        remaining.finishedAt = step.finishedAt
      }
      break
    }
    updateWorkflowRun(run)
  }
  if (run.status === 'running') run.status = 'succeeded'
  run.finishedAt = new Date().toISOString()
  updateWorkflowRun(run)
}

export const startManualWorkflowRun = (workflowId: string) => {
  const workflow = getWorkflow(workflowId)
  if (workflow.trigger?.kind !== 'manual') {
    throw createError({ statusCode: 409, statusMessage: '请选择手动触发器后运行', data: { code: 'workflow.manual-trigger-required' } })
  }
  if (!workflow.nodes.length) {
    throw createError({ statusCode: 409, statusMessage: '请至少添加并连接一个操作节点', data: { code: 'workflow.empty' } })
  }
  const snapshot = validateWorkflowForExecution(workflow)
  const inputs = snapshot.nodes.map(node => assetOperationInput(node.operationId, node.inputs))
  const run: WorkflowRun = {
    id: randomUUID(),
    workflowId,
    workflow: snapshot,
    status: 'running',
    steps: snapshot.nodes.map(node => ({
      nodeId: node.id, status: 'pending', startedAt: null, finishedAt: null, output: null, error: null,
    })),
    startedAt: new Date().toISOString(),
    finishedAt: null,
  }
  runInTransaction(() => {
    assertWorkflowIdle(workflowId)
    insertWorkflowRun(run)
  })
  const completion = executeRun(run, inputs)
  return { run: structuredClone(run), completion }
}

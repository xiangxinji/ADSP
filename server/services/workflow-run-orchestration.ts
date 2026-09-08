import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { insertWorkflowRun, listWorkflowRuns } from '../repositories/workflow-runs'
import { runInTransaction } from '../repositories/unit-of-work'
import { assetOperationInput } from '../validation/asset-operation-input'
import { executeWorkflowGraph, type WorkflowRunInputs } from './workflow-graph-execution'
import { getWorkflow, validateWorkflowForExecution } from './workflow-definitions'
import { assertWorkflowIdle } from './workflow-runs'

export const getWorkflowRuns = (workflowId: string) => {
  getWorkflow(workflowId)
  return listWorkflowRuns(workflowId)
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
  const inputs: WorkflowRunInputs = new Map()
  for (const node of snapshot.nodes) {
    if (node.kind !== 'async') inputs.set(node.id, assetOperationInput(node.operationId, node.inputs))
  }
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
  const completion = executeWorkflowGraph(run, inputs)
  return { run: structuredClone(run), completion }
}

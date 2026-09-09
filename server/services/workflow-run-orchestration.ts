import { createError } from 'h3'
import type { WorkflowValueObject } from '../../shared/types/asdp'
import { isWorkflowOperationNode } from '../../shared/utils/workflow-nodes'
import { insertWorkflowRun, listWorkflowRuns } from '../repositories/workflow-runs'
import { runInTransaction } from '../repositories/unit-of-work'
import { assetOperationInput } from '../validation/asset-operation-input'
import { executeWorkflowGraph } from './workflow-graph-execution'
import { getWorkflow, getReferencedWorkflows, validateWorkflowForExecution } from './workflow-definitions'
import { assertWorkflowIdle, createWorkflowRun } from './workflow-runs'
import { createAssetOperationError } from '../utils/asset-operation-error'
import { workflowInputHasReferences } from './workflow-value-resolution'

export const getWorkflowRuns = (workflowId: string) => {
  getWorkflow(workflowId)
  return listWorkflowRuns(workflowId)
}

export const startManualWorkflowRun = (workflowId: string, root: WorkflowValueObject = {}) => {
  const workflow = getWorkflow(workflowId)
  if (workflow.trigger?.kind !== 'manual') {
    throw createError({ statusCode: 409, statusMessage: '请选择手动触发器后运行', data: { code: 'workflow.manual-trigger-required' } })
  }
  if (!workflow.nodes.length) {
    throw createError({ statusCode: 409, statusMessage: '请至少添加并连接一个操作节点', data: { code: 'workflow.empty' } })
  }
  const workflows = new Map(getReferencedWorkflows(workflow).map(definition => {
    if (!definition.trigger || !definition.nodes.length) {
      throw createAssetOperationError(400, 'workflow.subworkflow-not-ready', `子工作流“${definition.name}”需要配置触发器并连接至少一个节点。`)
    }
    const snapshot = validateWorkflowForExecution(definition)
    for (const node of snapshot.nodes.filter(isWorkflowOperationNode)) {
      if (!workflowInputHasReferences(node.inputs)) assetOperationInput(node.operationId, node.inputs)
    }
    return [snapshot.id, snapshot] as const
  }))
  const run = createWorkflowRun(workflows.get(workflowId)!, root)
  run.referencedWorkflowIds = [...workflows.keys()].filter(id => id !== workflowId)
  runInTransaction(() => {
    assertWorkflowIdle(workflowId)
    insertWorkflowRun(run)
  })
  const completion = executeWorkflowGraph(run, new Map(), { workflows })
  return { run: structuredClone(run), completion }
}

import { findAssetOperation } from '../../shared/config/asset-operations'
import type { WorkflowOperationInputValue, WorkflowValue } from '../../shared/types/asdp'
import type { WorkflowAsyncBranchResult, WorkflowRun, WorkflowRunError } from '../../shared/types/workflow-runs'
import { workflowTriggerNodeId } from '../../shared/utils/workflow-graph'
import { updateWorkflowRun } from '../repositories/workflow-runs'
import { assetOperationErrorCode } from '../utils/asset-operation-error'
import { assetOperationInput as validateAssetOperationInput } from '../validation/asset-operation-input'
import { executeAssetOperation } from './asset-operations'
import { assertWorkflowOperationOutput, resolveWorkflowOperationInputs } from './workflow-value-resolution'

type ExecutionFailure = { nodeId: string, error: WorkflowRunError }
export type WorkflowRunInputs = Map<string, Record<string, WorkflowOperationInputValue>>

const operationError = (error: unknown): WorkflowRunError => {
  const code = assetOperationErrorCode(error)
  return {
    code: code || 'workflow.operation-failed',
    message: code && error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage) : '节点执行失败，请检查服务日志和资产状态。',
  }
}

export const executeWorkflowGraph = async (run: WorkflowRun, inputs: WorkflowRunInputs) => {
  const nodesById = new Map(run.workflow.nodes.map(node => [node.id, node]))
  const stepsById = new Map(run.steps.map(step => [step.nodeId, step]))
  const targetFor = (nodeId: string, sourceHandle?: string) => run.workflow.edges
    .find(edge => edge.source === nodeId && edge.sourceHandle === sourceHandle)?.target

  const skipPath = (nodeId?: string) => {
    if (!nodeId) return
    const step = stepsById.get(nodeId)!
    if (step.status !== 'pending') return
    step.status = 'skipped'
    step.finishedAt = new Date().toISOString()
    run.workflow.edges.filter(edge => edge.source === nodeId).forEach(edge => skipPath(edge.target))
  }

  const executePath = async (nodeId?: string, previous?: WorkflowValue): Promise<ExecutionFailure | null> => {
    if (!nodeId) return null
    const node = nodesById.get(nodeId)!
    const step = stepsById.get(nodeId)!
    step.status = 'running'
    step.startedAt = new Date().toISOString()
    updateWorkflowRun(run)

    if (node.kind === 'async') {
      const connectedBranches = node.branches.flatMap(branch => {
        const target = targetFor(node.id, branch.id)
        return target ? [{ branch, target }] : []
      })
      const branches = await Promise.all(connectedBranches.map(async ({ branch, target }): Promise<WorkflowAsyncBranchResult> => {
        const failure = await executePath(target, previous)
        return {
          portId: branch.id, nodeId: target, status: failure ? 'failed' : 'succeeded',
          failedNodeId: failure?.nodeId || null, error: failure?.error || null,
        }
      }))
      const failedBranch = branches.find(branch => branch.status === 'failed')
      const selectedPort = failedBranch ? 'error' : 'complete'
      step.output = { branches, selectedPort }
      step.status = failedBranch ? 'failed' : 'succeeded'
      step.error = failedBranch ? { code: 'workflow.async-branch-failed', message: '子流程执行失败，原始节点和错误码见分支结果。' } : null
      step.finishedAt = new Date().toISOString()
      skipPath(targetFor(node.id, failedBranch ? 'complete' : 'error'))
      updateWorkflowRun(run)
      const outletFailure = await executePath(targetFor(node.id, selectedPort), step.output as WorkflowValue)
      return failedBranch
        ? { nodeId: failedBranch.failedNodeId!, error: failedBranch.error! }
        : outletFailure
    }

    let nextNodeId: string | undefined
    let nextValue: WorkflowValue | undefined
    try {
      const operation = findAssetOperation(node.assetType, node.operationId)!
      step.resolvedInputs = resolveWorkflowOperationInputs(
        inputs.get(node.id) || node.inputs,
        operation.contract.input,
        run.root,
        previous,
      )
      const operationInput = validateAssetOperationInput(node.operationId, step.resolvedInputs)
      const output = await executeAssetOperation(node.assetType, node.assetId, node.operationId, operationInput)
      assertWorkflowOperationOutput(operation.contract.output, output)
      step.output = output
      nextValue = output as WorkflowValue
      step.status = 'succeeded'
      nextNodeId = targetFor(node.id)
    } catch (error) {
      step.status = 'failed'
      step.error = operationError(error)
      const port = node.exceptionPorts?.find(port => port.code === step.error?.code)
      if (port) {
        nextNodeId = targetFor(node.id, port.id)
        nextValue = step.error
      }
    }
    run.workflow.edges.filter(edge => edge.source === node.id && edge.target !== nextNodeId)
      .forEach(edge => skipPath(edge.target))
    step.finishedAt = new Date().toISOString()
    updateWorkflowRun(run)
    const nextFailure = await executePath(nextNodeId, nextValue)
    return step.error ? { nodeId, error: step.error } : nextFailure
  }

  await executePath(targetFor(workflowTriggerNodeId), run.root)
  run.status = run.steps.some(step => step.status === 'failed') ? 'failed' : 'succeeded'
  run.finishedAt = new Date().toISOString()
  updateWorkflowRun(run)
}

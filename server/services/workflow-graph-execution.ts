import { findAssetOperation, isProjectAssetOperation } from '../../shared/config/asset-operations'
import type { WorkflowDefinition, WorkflowOperationInputValue, WorkflowValue } from '../../shared/types/asdp'
import type { WorkflowBranchResult, WorkflowRun, WorkflowRunError } from '../../shared/types/workflow-runs'
import { workflowTriggerNodeId } from '../../shared/utils/workflow-graph'
import { isWorkflowControlNode, isWorkflowOperationNode, isWorkflowSubworkflowNode, workflowControlBranch } from '../../shared/utils/workflow-nodes'
import { workflowNestingLimit } from '../../shared/utils/workflow-references'
import { workflowAssetInputName, workflowAssetSource } from '../../shared/utils/workflow-operation-assets'
import { assetOperationErrorCode, createAssetOperationError } from '../utils/asset-operation-error'
import { assetOperationInput as validateAssetOperationInput } from '../validation/asset-operation-input'
import { executeAssetOperation } from './asset-operations'
import { executeProjectOperation } from './project-operation-execution'
import { agentExecutorForOperation } from '../../shared/types/agent-executors'
import { resolveWorkflowAssetId } from './workflow-asset-resolution'
import { assertWorkflowOperationOutput, resolveWorkflowOperationInputs } from './workflow-value-resolution'
import { createWorkflowExecutionContext, type WorkflowExecutionScope } from './workflow-execution-context'
import { createWorkflowRun } from './workflow-runs'

type ExecutionFailure = { nodeId: string, error: WorkflowRunError }
type ExecutionResult = { failure: ExecutionFailure | null, output: WorkflowValue }
type WorkflowExecutionOptions = {
  workflows?: ReadonlyMap<string, WorkflowDefinition>
  ancestors?: string[]
  persist?: () => void
}
export type WorkflowRunInputs = Map<string, Record<string, WorkflowOperationInputValue>>

const operationError = (error: unknown): WorkflowRunError => {
  const code = assetOperationErrorCode(error)
  return {
    code: code || 'workflow.operation-failed',
    message: code && error && typeof error === 'object' && 'statusMessage' in error
      ? String(error.statusMessage) : '节点执行失败，请检查服务日志和资产状态。',
  }
}

export const executeWorkflowGraph = async (run: WorkflowRun, inputs: WorkflowRunInputs, options: WorkflowExecutionOptions = {}) => {
  const nodesById = new Map(run.workflow.nodes.map(node => [node.id, node]))
  const { rootScope, iterationScope, getStep, persist } = createWorkflowExecutionContext(run, options.persist)
  const ancestors = [...(options.ancestors || []), run.workflowId]
  const targetFor = (nodeId: string, sourceHandle?: string) => run.workflow.edges
    .find(edge => edge.source === nodeId && edge.sourceHandle === sourceHandle)?.target

  const skipPath = (nodeId: string | undefined, scope: WorkflowExecutionScope) => {
    if (!nodeId) return
    const step = getStep(nodeId, scope)
    if (step.status !== 'pending') return
    step.status = 'skipped'
    step.finishedAt = new Date().toISOString()
    run.workflow.edges.filter(edge => edge.source === nodeId).forEach(edge => skipPath(edge.target, scope))
  }

  const executePath = async (nodeId: string | undefined, previous: WorkflowValue | undefined, scope: WorkflowExecutionScope): Promise<ExecutionResult> => {
    if (!nodeId) return { failure: null, output: previous ?? null }
    const node = nodesById.get(nodeId)!
    const step = getStep(nodeId, scope)
    step.status = 'running'
    step.startedAt = new Date().toISOString()
    persist()

    if (isWorkflowControlNode(node)) {
      const target = targetFor(node.id, workflowControlBranch.id)
      const branches: WorkflowBranchResult[] = []
      const inputError: WorkflowRunError | null = !Array.isArray(previous)
        ? { code: 'workflow.control-input-not-array', message: '流程控制节点的上一个节点必须直接输出数组。' }
        : !target ? { code: 'workflow.control-child-required', message: '请为逐项执行端点连接唯一的子节点。' } : null
      if (!inputError && Array.isArray(previous) && target) {
        branches.push(...previous.map((input, index) => ({
          portId: workflowControlBranch.id, nodeId: target, index, input, status: 'skipped' as const,
          failedNodeId: null, error: null,
        })))
        const executeItem = async (result: WorkflowBranchResult) => {
          const { failure } = await executePath(target, result.input, iterationScope(scope, node.id, result.index!))
          result.status = failure ? 'failed' : 'succeeded'
          result.failedNodeId = failure?.nodeId || null
          result.error = failure?.error || null
        }
        if (node.kind === 'async') {
          await Promise.all(branches.map(executeItem))
        } else {
          let failed = false
          for (const result of branches) {
            if (failed) {
              skipPath(target, iterationScope(scope, node.id, result.index!))
              continue
            }
            await executeItem(result)
            failed = result.status === 'failed'
          }
        }
      }
      if (!branches.length) skipPath(target, scope)
      const failedBranch = branches.find(branch => branch.status === 'failed')
      const selectedPort = inputError || failedBranch ? 'error' : 'complete'
      step.output = { branches, selectedPort }
      step.status = selectedPort === 'error' ? 'failed' : 'succeeded'
      step.error = inputError || (failedBranch ? { code: `workflow.${node.kind}-branch-failed`, message: '数组元素的子流程执行失败，原始节点和错误码见逐项结果。' } : null)
      step.finishedAt = new Date().toISOString()
      skipPath(targetFor(node.id, selectedPort === 'error' ? 'complete' : 'error'), scope)
      persist()
      const outlet = await executePath(targetFor(node.id, selectedPort), step.output as WorkflowValue, scope)
      return { output: outlet.output, failure: inputError ? { nodeId, error: inputError } : failedBranch
        ? { nodeId: failedBranch.failedNodeId!, error: failedBranch.error! } : outlet.failure }
    }

    let nextNodeId: string | undefined
    let nextValue: WorkflowValue | undefined
    try {
      if (isWorkflowSubworkflowNode(node)) {
        const child = options.workflows?.get(node.workflowId)
        if (!child) throw createAssetOperationError(404, 'workflow.subworkflow-not-found', '子工作流快照不存在。')
        if (child.projectId !== run.workflow.projectId) throw createAssetOperationError(400, 'workflow.subworkflow-project-mismatch', '子工作流必须属于当前项目。')
        if (ancestors.includes(child.id)) throw createAssetOperationError(400, 'workflow.subworkflow-cycle', '工作流不能循环调用。')
        if (ancestors.length >= workflowNestingLimit) throw createAssetOperationError(400, 'workflow.subworkflow-depth-exceeded', '工作流嵌套层数超出限制。')
        const childRun = createWorkflowRun(child, previous ?? null)
        step.childRun = childRun
        persist()
        await executeWorkflowGraph(childRun, new Map(), { ...options, ancestors, persist })
        if (childRun.status === 'failed') throw createAssetOperationError(422, 'workflow.subworkflow-failed', `子工作流“${child.name}”执行失败，请展开内部执行记录查看原因。`)
        step.output = childRun.output ?? null
      } else {
        const operation = findAssetOperation(node.assetType, node.operationId)!
        step.resolvedInputs = resolveWorkflowOperationInputs(
          inputs.get(node.id) || node.inputs,
          operation.contract.input,
          run.root,
          previous,
        )
        let output
        if (isProjectAssetOperation(operation)) {
          if (agentExecutorForOperation(node.operationId)) step.resolvedInputs.upstream = JSON.stringify(previous ?? run.root)
          persist()
          const execution = executeProjectOperation(run.workflow.projectId, node.assetType, node.operationId, step.resolvedInputs)
          output = execution instanceof Promise ? await execution : execution
        } else {
          const assetId = workflowAssetSource(node) === 'fixed' ? node.assetId!
            : resolveWorkflowAssetId(run.workflow.projectId, node.assetType, step.resolvedInputs[workflowAssetInputName(node)])
          step.resolvedInputs[workflowAssetInputName(node)] = assetId
          const operationInput = validateAssetOperationInput(node.operationId, step.resolvedInputs)
          output = await executeAssetOperation(node.assetType, assetId, node.operationId, operationInput)
        }
        assertWorkflowOperationOutput(operation.contract.output, output, 'outputType' in operation.contract ? operation.contract.outputType : undefined)
        step.output = output
      }
      nextValue = step.output as WorkflowValue
      step.status = 'succeeded'
      nextNodeId = targetFor(node.id)
    } catch (error) {
      step.status = 'failed'
      step.error = operationError(error)
      const port = isWorkflowOperationNode(node) ? node.exceptionPorts?.find(port => port.code === step.error?.code) : undefined
      if (port) {
        step.status = 'handled'
        nextNodeId = targetFor(node.id, port.id)
        nextValue = {
          ...(previous !== null && typeof previous === 'object' ? previous : {}),
          error: step.error,
        }
      }
    }
    run.workflow.edges.filter(edge => edge.source === node.id && edge.target !== nextNodeId)
      .forEach(edge => skipPath(edge.target, scope))
    step.finishedAt = new Date().toISOString()
    persist()
    const next = await executePath(nextNodeId, nextValue, scope)
    return { output: next.output, failure: step.status === 'failed' && step.error ? { nodeId, error: step.error } : next.failure }
  }

  const result = await executePath(targetFor(workflowTriggerNodeId), run.root, rootScope)
  run.status = run.steps.some(step => step.status === 'failed') ? 'failed' : 'succeeded'
  run.output = run.status === 'succeeded' ? result.output : null
  run.finishedAt = new Date().toISOString()
  persist()
}

import { computed, ref, watch } from 'vue'
import { isWorkflowControlNode, isWorkflowSubworkflowNode } from '#shared/utils/workflow-nodes'
import type { WorkflowControlOutput, WorkflowRun, WorkflowRunStep } from '#shared/types/workflow-runs'

export const useWorkflowRunStepDetails = (run: () => WorkflowRun, summaryStep: () => WorkflowRunStep) => {
  const selectedIteration = ref(-1)
  watch(() => [run().id, summaryStep().nodeId], () => { selectedIteration.value = -1 })
  const selectedStep = computed(() => summaryStep().executions?.[selectedIteration.value] || summaryStep())
  const selectedNode = computed(() => run().workflow.nodes.find(node => node.id === selectedStep.value.nodeId))
  const legacyControl = computed(() => isWorkflowControlNode(selectedNode.value)
    && (selectedNode.value.branches.length !== 1 || selectedNode.value.branches[0]?.id !== 'item'))
  const selectedInputs = computed(() => isWorkflowControlNode(selectedNode.value)
    ? legacyControl.value ? { branches: selectedNode.value.branches } : { input: '上一个节点的输出数组', childPort: 'item' }
    : isWorkflowSubworkflowNode(selectedNode.value)
      ? { workflowId: selectedNode.value.workflowId, root: '上游输出', output: '子工作流最终输出' }
      : selectedNode.value?.inputs)
  const controlOutput = computed(() => {
    const output = selectedStep.value.output
    return isWorkflowControlNode(selectedNode.value) && output && typeof output === 'object' && !Array.isArray(output)
      && 'branches' in output && 'selectedPort' in output ? output as WorkflowControlOutput : null
  })
  const branchLabel = (portId: string) => isWorkflowControlNode(selectedNode.value)
    ? selectedNode.value.branches.find(branch => branch.id === portId)?.label || portId : portId
  const duration = computed(() => {
    const step = selectedStep.value
    if (!step.startedAt || !step.finishedAt) return step.status === 'running' ? '执行中' : '—'
    return `${((Date.parse(step.finishedAt) - Date.parse(step.startedAt)) / 1000).toFixed(2)} 秒`
  })

  return { selectedIteration, selectedStep, selectedNode, legacyControl, selectedInputs, controlOutput, branchLabel, duration }
}

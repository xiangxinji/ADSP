import type { WorkflowRun } from '#shared/types/workflow-runs'
import { workflowNodeLabel } from '#shared/utils/workflow-nodes'

export const workflowRunNodeLabel = (run: WorkflowRun | null, nodeId: string) => {
  const node = run?.workflow.nodes.find(item => item.id === nodeId)
  return node ? workflowNodeLabel(node) : nodeId
}

export const formatWorkflowRunTime = (value: string | null) => value
  ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'

import type { WorkflowStepStatus } from '../types/workflow-runs'

export const workflowRunStatusLabels: Record<WorkflowStepStatus, string> = {
  pending: '等待执行',
  running: '执行中',
  succeeded: '执行成功',
  handled: '异常已处理',
  failed: '执行失败',
  skipped: '已跳过',
}

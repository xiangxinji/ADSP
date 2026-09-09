import type { WorkflowEventTriggerKind, WorkflowTrigger, WorkflowValueObject } from '../types/asdp'

export const workflowTriggerFilterError = (trigger: WorkflowTrigger | null) => {
  if (trigger?.statusIds === undefined) return ''
  if (trigger.kind !== 'requirement-status-changed') return '只有需求状态变更触发器可以配置目标状态。'
  if (!Array.isArray(trigger.statusIds) || !trigger.statusIds.length) return '请选择至少一个目标状态。'
  if (trigger.statusIds.some(statusId => typeof statusId !== 'string' || !statusId.trim())) {
    return '目标状态 ID 不能为空。'
  }
  return ''
}

export const workflowTriggerMatchesEvent = (
  trigger: WorkflowTrigger | null,
  eventType: WorkflowEventTriggerKind,
  payload: WorkflowValueObject,
) => {
  if (!trigger || trigger.kind !== eventType) return false
  if (eventType !== 'requirement-status-changed' || trigger.statusIds === undefined) return true
  return typeof payload.statusId === 'string' && trigger.statusIds.includes(payload.statusId)
}

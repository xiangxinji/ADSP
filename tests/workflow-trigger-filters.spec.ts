import { ref } from 'vue'
import { describe, expect, test } from 'vitest'
import type { WorkflowDefinition, WorkflowTrigger } from '../shared/types/asdp'
import { workflowTriggerFilterError, workflowTriggerMatchesEvent } from '../shared/utils/workflow-triggers'
import { useWorkflowTrigger } from '../app/composables/useWorkflowTrigger'
import { workflowFixture } from './support/workflow-fixtures'

const trigger = (statusIds?: string[]): WorkflowTrigger => ({
  kind: 'requirement-status-changed', position: { x: 120, y: 80 },
  ...(statusIds === undefined ? {} : { statusIds }),
})

describe('workflow target status filters', () => {
  test('matches the destination status rather than the previous status or display name', () => {
    const configured = trigger(['ready', 'review'])
    expect(workflowTriggerMatchesEvent(configured, 'requirement-status-changed', { statusId: 'ready' })).toBe(true)
    expect(workflowTriggerMatchesEvent(configured, 'requirement-status-changed', { statusId: 'review' })).toBe(true)
    expect(workflowTriggerMatchesEvent(configured, 'requirement-status-changed', { statusId: 'draft', previousStatusId: 'ready' })).toBe(false)
    expect(workflowTriggerMatchesEvent(configured, 'requirement-status-changed', { statusId: '已就绪' })).toBe(false)
    expect(workflowTriggerMatchesEvent(configured, 'requirement-status-changed', {})).toBe(false)
    expect(workflowTriggerMatchesEvent(configured, 'requirement-created', { statusId: 'ready' })).toBe(false)
  })

  test('preserves legacy any-status behavior and fails closed for an empty filter', () => {
    expect(workflowTriggerMatchesEvent(trigger(), 'requirement-status-changed', { statusId: 'draft' })).toBe(true)
    expect(workflowTriggerMatchesEvent(trigger([]), 'requirement-status-changed', { statusId: 'draft' })).toBe(false)
    expect(workflowTriggerMatchesEvent(null, 'requirement-status-changed', { statusId: 'draft' })).toBe(false)
    expect(workflowTriggerFilterError(trigger())).toBe('')
    expect(workflowTriggerFilterError(trigger(['ready']))).toBe('')
    expect(workflowTriggerFilterError(trigger([]))).toContain('至少一个')
    expect(workflowTriggerFilterError(trigger([' ']))).toContain('不能为空')
    expect(workflowTriggerFilterError({ ...trigger(['ready']), kind: 'manual' })).toContain('只有需求状态变更')
  })

  test('preserves a selection when reselecting the root or moving it and requires explicit any-status mode', () => {
    const draft = ref<WorkflowDefinition | null>({ ...workflowFixture([], []), trigger: trigger() })
    const editor = useWorkflowTrigger(draft)
    editor.updateTriggerStatusIds([])
    expect(workflowTriggerFilterError(draft.value!.trigger)).toContain('至少一个')
    editor.updateTriggerStatusIds(['ready', 'review', 'ready'])
    editor.selectTrigger('requirement-status-changed')
    draft.value!.trigger!.position = { x: 200, y: 200 }
    expect(draft.value!.trigger).toEqual({ ...trigger(['ready', 'review']), position: { x: 200, y: 200 } })
    editor.updateTriggerStatusIds(undefined)
    expect(draft.value!.trigger).not.toHaveProperty('statusIds')
  })

  test('clears irrelevant filters when changing trigger kinds without moving the root', () => {
    const draft = ref<WorkflowDefinition | null>({ ...workflowFixture([], []), trigger: trigger(['ready']) })
    const editor = useWorkflowTrigger(draft)
    editor.selectTrigger('manual')
    editor.updateTriggerStatusIds(['review'])
    expect(draft.value!.trigger).toEqual({ kind: 'manual', position: trigger().position })
    editor.selectTrigger('requirement-status-changed')
    expect(draft.value!.trigger).toEqual(trigger())
  })
})

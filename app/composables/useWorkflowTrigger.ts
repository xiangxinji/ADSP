import type { Ref } from 'vue'
import type { WorkflowDefinition, WorkflowTriggerKind } from '#shared/types/asdp'

export const useWorkflowTrigger = (draft: Ref<WorkflowDefinition | null>) => {
  const selectTrigger = (kind: WorkflowTriggerKind) => {
    if (!draft.value || draft.value.trigger?.kind === kind) return
    draft.value.trigger = { kind, position: draft.value.trigger?.position || { x: 260, y: 80 } }
  }

  const updateTriggerStatusIds = (statusIds: string[] | undefined) => {
    const trigger = draft.value?.trigger
    if (trigger?.kind !== 'requirement-status-changed') return
    if (statusIds === undefined) delete trigger.statusIds
    else trigger.statusIds = [...new Set(statusIds)]
  }

  return { selectTrigger, updateTriggerStatusIds }
}

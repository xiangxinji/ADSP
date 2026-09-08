import type { ComputedRef, Ref } from 'vue'
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from '#shared/types/asdp'
import { validateWorkflowEdges } from '#shared/utils/workflow-graph'

export const useWorkflowConnections = (
  draft: Ref<WorkflowDefinition | null>,
  selectedNode: ComputedRef<WorkflowNode | null>,
  actionError: Ref<string>,
) => {
  const connectEdge = (connection: Pick<WorkflowEdge, 'source' | 'target' | 'sourceHandle'>, replaceIncoming = false) => {
    if (!draft.value || !connection.source || !connection.target) return
    if (!draft.value.trigger) {
      actionError.value = '请先选择根触发器。'
      return
    }
    const candidateEdges = replaceIncoming
      ? draft.value.edges.filter(edge => edge.target !== connection.target)
      : draft.value.edges
    const edges = [...candidateEdges, { id: globalThis.crypto.randomUUID(), ...connection }]
    actionError.value = validateWorkflowEdges(draft.value.nodes, edges)
    if (!actionError.value) draft.value.edges = edges
  }

  const setUpstream = (source: Pick<WorkflowEdge, 'source' | 'sourceHandle'> | null) => {
    if (!draft.value || !selectedNode.value) return
    if (!source) {
      draft.value.edges = draft.value.edges.filter(edge => edge.target !== selectedNode.value?.id)
      actionError.value = ''
      return
    }
    connectEdge({ ...source, target: selectedNode.value.id }, true)
  }

  const removeEdge = (edgeId: string) => {
    if (!draft.value) return
    draft.value.edges = draft.value.edges.filter(edge => edge.id !== edgeId)
    actionError.value = ''
  }

  return { connectEdge, removeEdge, setUpstream }
}

import type { ComputedRef, Ref } from 'vue'
import type { WorkflowDefinition, WorkflowEdge, WorkflowOperationNode } from '#shared/types/asdp'
import { workflowTriggerNodeId } from '#shared/utils/workflow-graph'

export const useWorkflowConnections = (
  draft: Ref<WorkflowDefinition | null>,
  selectedNode: ComputedRef<WorkflowOperationNode | null>,
  actionError: Ref<string>,
) => {
  const connectEdge = (connection: Pick<WorkflowEdge, 'source' | 'target'>, replaceIncoming = false) => {
    if (!draft.value || !connection.source || !connection.target) return
    actionError.value = ''
    const candidateEdges = replaceIncoming
      ? draft.value.edges.filter(edge => edge.target !== connection.target)
      : draft.value.edges
    if (connection.target === workflowTriggerNodeId || connection.source === connection.target) {
      actionError.value = '根触发器不能作为终点，节点也不能连接到自身。'
      return
    }
    if (candidateEdges.some(edge => edge.source === connection.source)) {
      actionError.value = '一期流程中每个节点只能连接一个下游，请先删除旧连线。'
      return
    }
    if (candidateEdges.some(edge => edge.target === connection.target)) {
      actionError.value = '一期流程中每个操作节点只能连接一个上游，请先删除旧连线。'
      return
    }
    const outgoing = new Map(candidateEdges.map(edge => [edge.source, edge.target]))
    let cursor: string | undefined = connection.target
    while (cursor) {
      if (cursor === connection.source) {
        actionError.value = '工作流不能形成环路。'
        return
      }
      cursor = outgoing.get(cursor)
    }
    draft.value.edges = [...candidateEdges, { id: globalThis.crypto.randomUUID(), ...connection }]
  }

  const setUpstream = (sourceId: string) => {
    if (!draft.value || !selectedNode.value) return
    if (!sourceId) {
      draft.value.edges = draft.value.edges.filter(edge => edge.target !== selectedNode.value?.id)
      return
    }
    connectEdge({ source: sourceId, target: selectedNode.value.id }, true)
  }

  const removeEdge = (edgeId: string) => {
    if (!draft.value) return
    draft.value.edges = draft.value.edges.filter(edge => edge.id !== edgeId)
    actionError.value = ''
  }

  return { connectEdge, removeEdge, setUpstream }
}

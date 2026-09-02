import type { WorkflowEdge } from '../types/asdp'

export const workflowTriggerNodeId = 'workflow-trigger'

export type WorkflowGraphAnalysis = {
  message: string
  orderedNodeIds: string[]
}

export const analyzeWorkflowGraph = (
  nodeIds: string[],
  edges: WorkflowEdge[],
  triggerConfigured: boolean,
): WorkflowGraphAnalysis => {
  if (!triggerConfigured && (nodeIds.length || edges.length)) {
    return { message: '请先选择根触发器。', orderedNodeIds: [] }
  }
  if (!nodeIds.length) {
    return edges.length
      ? { message: '没有操作节点时不能保留连线。', orderedNodeIds: [] }
      : { message: '', orderedNodeIds: [] }
  }

  const nodeIdSet = new Set(nodeIds)
  const validIds = new Set([workflowTriggerNodeId, ...nodeIds])
  const outgoing = new Map<string, string>()
  const incoming = new Map<string, string>()
  const edgeIds = new Set<string>()
  const connections = new Set<string>()

  for (const edge of edges) {
    if (!edge.id.trim() || edgeIds.has(edge.id)) return { message: '连线 ID 必须存在且唯一。', orderedNodeIds: [] }
    edgeIds.add(edge.id)
    if (!validIds.has(edge.source) || !validIds.has(edge.target)) return { message: '连线引用了不存在的节点。', orderedNodeIds: [] }
    if (edge.target === workflowTriggerNodeId) return { message: '根触发器不能作为连线终点。', orderedNodeIds: [] }
    if (edge.source === edge.target) return { message: '节点不能连接到自身。', orderedNodeIds: [] }
    const connection = `${edge.source}\u0000${edge.target}`
    if (connections.has(connection)) return { message: '不能重复连接相同的节点。', orderedNodeIds: [] }
    connections.add(connection)
    if (outgoing.has(edge.source)) return { message: '一期流程中每个节点只能连接一个下游节点。', orderedNodeIds: [] }
    if (incoming.has(edge.target)) return { message: '一期流程中每个操作节点只能连接一个上游节点。', orderedNodeIds: [] }
    outgoing.set(edge.source, edge.target)
    incoming.set(edge.target, edge.source)
  }

  if (!outgoing.has(workflowTriggerNodeId)) return { message: '请从根触发器连接第一个操作节点。', orderedNodeIds: [] }
  const unconnectedNode = nodeIds.find(nodeId => !incoming.has(nodeId))
  if (unconnectedNode) return { message: '每个操作节点都必须连接到流程中。', orderedNodeIds: [] }

  const orderedNodeIds: string[] = []
  const visited = new Set<string>([workflowTriggerNodeId])
  let current = workflowTriggerNodeId
  while (outgoing.has(current)) {
    const next = outgoing.get(current) as string
    if (visited.has(next)) return { message: '工作流不能形成环路。', orderedNodeIds: [] }
    if (!nodeIdSet.has(next)) return { message: '连线引用了不存在的操作节点。', orderedNodeIds: [] }
    visited.add(next)
    orderedNodeIds.push(next)
    current = next
  }

  if (orderedNodeIds.length !== nodeIds.length) return { message: '所有操作节点必须从根触发器连续可达。', orderedNodeIds: [] }
  return { message: '', orderedNodeIds }
}

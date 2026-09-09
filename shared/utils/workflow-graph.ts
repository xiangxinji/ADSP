import type { WorkflowEdge, WorkflowNode } from '../types/asdp'
import { isWorkflowControlNode, validateWorkflowControlNode, validateWorkflowExceptionPorts, workflowControlBranch, workflowControlNames, workflowNodeLimit, workflowOutputPorts } from './workflow-nodes'

export const workflowTriggerNodeId = 'workflow-trigger'

export type WorkflowGraphAnalysis = {
  message: string
  orderedNodeIds: string[]
}

export const validateWorkflowEdges = (nodes: WorkflowNode[], edges: WorkflowEdge[]): string => {
  if (nodes.length > workflowNodeLimit) return '工作流最多支持 50 个节点。'
  const nodesById = new Map(nodes.map(node => [node.id, node]))
  if (nodesById.size !== nodes.length || nodes.some(node => !node.id.trim() || node.id === workflowTriggerNodeId)) {
    return '节点 ID 必须存在且唯一，不能使用根触发器 ID。'
  }
  for (const node of nodes) {
    if (isWorkflowControlNode(node)) continue
    const message = validateWorkflowExceptionPorts(node)
    if (message) return message
  }
  const outgoing = new Map<string, WorkflowEdge[]>()
  const incoming = new Set<string>()
  const edgeIds = new Set<string>()
  for (const edge of edges) {
    if (!edge.id.trim() || edgeIds.has(edge.id)) return '连线 ID 必须存在且唯一。'
    edgeIds.add(edge.id)
    if ((!nodesById.has(edge.source) && edge.source !== workflowTriggerNodeId) || !nodesById.has(edge.target)) {
      return '连线引用了不存在的节点，根触发器不能作为终点。'
    }
    if (edge.source === edge.target) return '节点不能连接到自身。'
    const ports = workflowOutputPorts(nodesById.get(edge.source))
    if (!ports.some(port => port.id === edge.sourceHandle)) return '连线必须选择有效的输出端点。'
    const siblings = outgoing.get(edge.source) || []
    if (siblings.some(sibling => sibling.sourceHandle === edge.sourceHandle)) return '每个输出端点只能连接一个下游节点。'
    if (incoming.has(edge.target)) return '每个节点只能连接一个上游节点，子流程不能交叉合流。'
    outgoing.set(edge.source, [...siblings, edge])
    incoming.add(edge.target)
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const hasCycle = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true
    if (visited.has(nodeId)) return false
    visiting.add(nodeId)
    if ((outgoing.get(nodeId) || []).some(edge => hasCycle(edge.target))) return true
    visiting.delete(nodeId)
    visited.add(nodeId)
    return false
  }
  return [...nodesById.keys()].some(hasCycle) ? '工作流不能形成环路。' : ''
}

export const analyzeWorkflowGraph = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  triggerConfigured: boolean,
): WorkflowGraphAnalysis => {
  const invalid = (message: string): WorkflowGraphAnalysis => ({ message, orderedNodeIds: [] })
  if (!triggerConfigured && (nodes.length || edges.length)) return invalid('请先选择根触发器。')
  const edgeError = validateWorkflowEdges(nodes, edges)
  if (edgeError) return invalid(edgeError)
  for (const node of nodes) {
    if (!isWorkflowControlNode(node)) continue
    const nodeError = validateWorkflowControlNode(node)
    if (nodeError) return invalid(nodeError)
    if (!edges.some(edge => edge.source === node.id && edge.sourceHandle === workflowControlBranch.id)) {
      return invalid(workflowControlNames[node.kind] + '节点需要为固定子端点连接唯一的子节点。')
    }
  }
  if (nodes.length && !edges.some(edge => edge.source === workflowTriggerNodeId)) return invalid('请从根触发器连接第一个节点。')
  const nodesById = new Map(nodes.map(node => [node.id, node]))
  const orderedNodeIds: string[] = []
  const visit = (nodeId: string) => {
    if (nodeId !== workflowTriggerNodeId) orderedNodeIds.push(nodeId)
    for (const port of workflowOutputPorts(nodesById.get(nodeId))) {
      const next = edges.find(edge => edge.source === nodeId && edge.sourceHandle === port.id)
      if (next) visit(next.target)
    }
  }
  visit(workflowTriggerNodeId)
  return orderedNodeIds.length !== nodes.length
    ? invalid('所有节点必须从根触发器连续可达。')
    : { message: '', orderedNodeIds }
}

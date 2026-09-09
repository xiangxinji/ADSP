import type { Ref } from 'vue'
import type { Node } from '@vue-flow/core'
import { findAssetOperation, isProjectAssetOperation } from '#shared/config/asset-operations'
import type { ProjectWorkspace, WorkflowEdge, WorkflowNode, WorkflowOperationNode, WorkflowTrigger } from '#shared/types/asdp'
import type { WorkflowRunStep } from '#shared/types/workflow-runs'
import { analyzeWorkflowGraph, workflowTriggerNodeId } from '#shared/utils/workflow-graph'
import { isWorkflowControlNode, isWorkflowSubworkflowNode, validateWorkflowControlNode, validateWorkflowExceptionPorts, validateWorkflowSubworkflowNode, workflowOperationExceptions } from '#shared/utils/workflow-nodes'
import { workflowValueReferenceError } from '#shared/utils/workflow-values'
import { workflowAssetInputName, workflowAssetSource } from '#shared/utils/workflow-operation-assets'

export type WorkflowCanvasProps = {
  trigger: WorkflowTrigger | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  workspace: ProjectWorkspace
  selectedNodeId: string | null
  runSteps?: WorkflowRunStep[]
  readOnly?: boolean
}
export type WorkflowConnectionSource = Pick<WorkflowEdge, 'source' | 'sourceHandle'>

export const useWorkflowCanvasNodes = (props: WorkflowCanvasProps, pendingSource: Ref<WorkflowConnectionSource | null>) => {
  const assetLabel = (node: WorkflowOperationNode) => {
    if (isProjectAssetOperation(findAssetOperation(node.assetType, node.operationId))) return '当前项目 · 全部资产'
    if (workflowAssetSource(node) === 'input') return `输入值 · ${node.inputs[workflowAssetInputName(node)] || '待配置'}`
    if (node.assetType === 'repository') return props.workspace.repositories.find(asset => asset.id === node.assetId)?.name
    if (node.assetType === 'member') return props.workspace.members.find(asset => asset.id === node.assetId)?.user.name
    if (node.assetType === 'environment') return props.workspace.environments.find(asset => asset.id === node.assetId)?.address
    return props.workspace.knowledge.find(asset => asset.id === node.assetId)?.title
  }
  const triggerLabels = {
    manual: { label: '手动触发', description: '输入 JSON 根数据 · 输出 object' },
    'requirement-created': { label: '需求创建时', description: '监听项目需求创建事件' },
    'requirement-status-changed': { label: '需求状态变更时', description: '需求 ID：$root.requirementId' },
  }
  return computed<Node[]>(() => {
    const graph = analyzeWorkflowGraph(props.nodes, props.edges, Boolean(props.trigger))
    const orderById = new Map(graph.orderedNodeIds.map((nodeId, index) => [nodeId, index + 1]))
    const triggerDetails = props.trigger ? triggerLabels[props.trigger.kind] : null
    return [{
      id: workflowTriggerNodeId, type: 'trigger',
      position: props.trigger?.position || { x: 260, y: 80 },
      draggable: Boolean(props.trigger) && !props.readOnly, selectable: false,
      data: {
        label: triggerDetails?.label || '请选择触发器',
        description: triggerDetails?.description || '从左侧节点库选择根触发器',
        configured: Boolean(props.trigger),
        connected: !props.nodes.length || props.edges.some(edge => edge.source === workflowTriggerNodeId),
        connectionSource: pendingSource.value?.source === workflowTriggerNodeId,
      },
    }, ...props.nodes.map((node, index) => {
      const connected = props.edges.some(edge => edge.target === node.id)
      const common = {
        id: node.id, position: node.position, selected: props.selectedNodeId === node.id,
      }
      const data = {
        order: orderById.get(node.id) || index + 1,
        connectionSource: pendingSource.value?.source === node.id,
        awaitingTarget: Boolean(pendingSource.value && pendingSource.value.source !== node.id),
        runStatus: props.runSteps?.find(step => step.nodeId === node.id)?.status,
        readOnly: props.readOnly,
      }
      if (isWorkflowControlNode(node)) {
        return { ...common, type: 'control', data: {
          ...data, kind: node.kind, label: node.label, branches: node.branches,
          connectionSourceHandle: data.connectionSource ? pendingSource.value?.sourceHandle || null : null,
          complete: props.readOnly || Boolean(connected && !validateWorkflowControlNode(node)
            && props.edges.some(edge => edge.source === node.id && node.branches.some(branch => branch.id === edge.sourceHandle))),
        } }
      }
      if (isWorkflowSubworkflowNode(node)) {
        const step = props.runSteps?.find(step => step.nodeId === node.id)
        const childSteps = (step?.executions || (step ? [step] : [])).flatMap(execution => execution.childRun?.steps || [])
        const target = props.workspace.workflows.find(workflow => workflow.id === node.workflowId)
        return { ...common, type: 'workflow', data: {
          ...data, label: node.label,
          workflowName: props.readOnly ? step?.childRun?.workflow.name || node.label : target?.name || '请选择子工作流',
          completedSteps: childSteps.filter(step => step.status === 'succeeded' || step.status === 'handled').length,
          totalSteps: childSteps.length,
          complete: props.readOnly || Boolean(connected && target && !validateWorkflowSubworkflowNode(node)),
        } }
      }
      const operation = findAssetOperation(node.assetType, node.operationId)
      const exceptions = workflowOperationExceptions(node)
      return { ...common, type: 'operation', data: {
        ...data, label: operation?.label || node.operationId,
        connectionSourceHandle: data.connectionSource ? pendingSource.value?.sourceHandle || null : null,
        exceptionPorts: (node.exceptionPorts || []).map(port => ({
          ...port, description: exceptions.find(exception => exception.code === port.code)?.description || port.code,
        })),
        canAddException: exceptions.some(exception => !node.exceptionPorts?.some(port => port.code === exception.code)),
        assetLabel: assetLabel(node) || '资产已不存在', description: operation?.description || '',
        complete: props.readOnly || Boolean(connected && assetLabel(node) && !validateWorkflowExceptionPorts(node) && operation?.workflow.enabled
          && !Object.values(node.inputs).some(workflowValueReferenceError)
          && operation.contract.input.every(field => !field.required || (node.inputs[field.name] !== undefined && node.inputs[field.name] !== ''))),
      } }
    })]
  })
}

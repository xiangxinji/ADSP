<script setup lang="ts">
import { MarkerType, VueFlow, useVueFlow, type Edge, type Node } from '@vue-flow/core'
import { findAssetOperation } from '#shared/config/asset-operations'
import type { ProjectWorkspace, WorkflowEdge, WorkflowOperationNode, WorkflowTrigger } from '#shared/types/asdp'
import { analyzeWorkflowGraph, workflowTriggerNodeId } from '#shared/utils/workflow-graph'

const props = defineProps<{
  trigger: WorkflowTrigger | null
  nodes: WorkflowOperationNode[]
  edges: WorkflowEdge[]
  workspace: ProjectWorkspace
  selectedNodeId: string | null
}>()

const emit = defineEmits<{
  selectNode: [id: string | null]
  updatePosition: [id: string, position: { x: number, y: number }]
  connectEdge: [connection: Pick<WorkflowEdge, 'source' | 'target'>]
  removeEdge: [id: string]
}>()

const { fitView, zoomIn, zoomOut } = useVueFlow({ id: 'workflow-definition-canvas' })
const selectedEdgeId = ref<string | null>(null)
const pendingSourceId = ref<string | null>(null)
const triggerLabels = {
  manual: { label: '手动触发', description: '由操作人员主动启动' },
  'requirement-created': { label: '需求创建时', description: '监听项目需求创建事件' },
}

const assetLabel = (node: WorkflowOperationNode) => {
  if (node.assetType === 'repository') return props.workspace.repositories.find(asset => asset.id === node.assetId)?.name
  if (node.assetType === 'member') return props.workspace.members.find(asset => asset.id === node.assetId)?.user.name
  if (node.assetType === 'environment') return props.workspace.environments.find(asset => asset.id === node.assetId)?.address
  return props.workspace.knowledge.find(asset => asset.id === node.assetId)?.title
}

const nodeComplete = (node: WorkflowOperationNode) => {
  const operation = findAssetOperation(node.assetType, node.operationId)
  const connected = props.edges.some(edge => edge.target === node.id)
  return Boolean(connected && assetLabel(node) && operation?.workflow.enabled && operation.contract.input.every(field =>
    !field.required || (node.inputs[field.name] !== undefined && node.inputs[field.name] !== ''),
  ))
}

const canvasNodes = computed<Node[]>(() => {
  const triggerDetails = props.trigger ? triggerLabels[props.trigger.kind] : null
  const graph = analyzeWorkflowGraph(props.nodes.map(node => node.id), props.edges, Boolean(props.trigger))
  const orderById = new Map(graph.orderedNodeIds.map((nodeId, index) => [nodeId, index + 1]))
  const triggerConnected = !props.nodes.length || props.edges.some(edge => edge.source === workflowTriggerNodeId)
  return [{
    id: workflowTriggerNodeId,
    type: 'trigger',
    position: props.trigger?.position || { x: 260, y: 80 },
    draggable: Boolean(props.trigger),
    selectable: false,
    data: {
      label: triggerDetails?.label || '请选择触发器',
      description: triggerDetails?.description || '从左侧节点库选择根触发器',
      configured: Boolean(props.trigger),
      connected: triggerConnected,
      connectionSource: pendingSourceId.value === workflowTriggerNodeId,
    },
  }, ...props.nodes.map((node, index) => {
    const operation = findAssetOperation(node.assetType, node.operationId)
    return {
      id: node.id,
      type: 'operation',
      position: node.position,
      selected: props.selectedNodeId === node.id,
      data: {
        label: operation?.label || node.operationId,
        assetLabel: assetLabel(node) || '资产已不存在',
        description: operation?.description || '',
        complete: nodeComplete(node),
        order: orderById.get(node.id) || index + 1,
        connectionSource: pendingSourceId.value === node.id,
        awaitingTarget: Boolean(pendingSourceId.value && pendingSourceId.value !== node.id),
      },
    }
  })]
})

const canvasEdges = computed<Edge[]>(() => props.edges.map(edge => ({
  ...edge,
  type: 'smoothstep',
  markerEnd: MarkerType.ArrowClosed,
  selected: selectedEdgeId.value === edge.id,
  selectable: true,
})))

const onNodeClick = ({ node }: { node: Node }) => {
  selectedEdgeId.value = null
  emit('selectNode', node.id === workflowTriggerNodeId ? null : node.id)
}
const onEdgeClick = ({ edge }: { edge: Edge }) => {
  selectedEdgeId.value = edge.id
  emit('selectNode', null)
}
const onConnect = (connection: { source?: string | null, target?: string | null }) => {
  if (connection.source && connection.target) emit('connectEdge', { source: connection.source, target: connection.target })
  pendingSourceId.value = null
}
const selectConnectionSource = (sourceId: string) => {
  pendingSourceId.value = pendingSourceId.value === sourceId ? null : sourceId
  selectedEdgeId.value = null
}
const selectConnectionTarget = (targetId: string) => {
  if (!pendingSourceId.value) return
  emit('connectEdge', { source: pendingSourceId.value, target: targetId })
  pendingSourceId.value = null
}
const clearSelection = () => {
  selectedEdgeId.value = null
  pendingSourceId.value = null
  emit('selectNode', null)
}
const removeSelectedEdge = () => {
  if (!selectedEdgeId.value) return
  emit('removeEdge', selectedEdgeId.value)
  selectedEdgeId.value = null
}
const onNodeDragStop = ({ node }: { node: Node }) => emit('updatePosition', node.id, { x: node.position.x, y: node.position.y })
let resizeTimer: ReturnType<typeof setTimeout> | undefined

const fitCanvas = () => fitView({ padding: 0.24, duration: 200 })
const onResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(fitCanvas, 150)
}

watch(() => props.nodes.length, async () => {
  await nextTick()
  requestAnimationFrame(() => requestAnimationFrame(fitCanvas))
})
watch(() => props.edges, edges => {
  if (selectedEdgeId.value && !edges.some(edge => edge.id === selectedEdgeId.value)) selectedEdgeId.value = null
}, { deep: true })
onMounted(() => {
  window.addEventListener('resize', onResize)
  requestAnimationFrame(() => requestAnimationFrame(fitCanvas))
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (resizeTimer) clearTimeout(resizeTimer)
})
</script>

<template>
  <section class="workflow-canvas" aria-label="工作流画板">
    <ClientOnly>
      <VueFlow id="workflow-definition-canvas" :nodes="canvasNodes" :edges="canvasEdges" :min-zoom="0.35" :max-zoom="1.6" :nodes-connectable="Boolean(trigger)" :edges-updatable="false" :delete-key-code="null" fit-view-on-init @connect="onConnect" @node-click="onNodeClick" @edge-click="onEdgeClick" @node-drag-stop="onNodeDragStop" @pane-click="clearSelection">
        <template #node-trigger="slotProps"><WorkflowTriggerNode v-bind="slotProps" @select-source="selectConnectionSource(slotProps.id)" /></template>
        <template #node-operation="slotProps"><WorkflowOperationNode v-bind="slotProps" @select-source="selectConnectionSource(slotProps.id)" @select-target="selectConnectionTarget(slotProps.id)" /></template>
        <div v-if="pendingSourceId" class="workflow-connection-status" role="status">已选择起点，请点击下游节点卡片或顶部圆点。<button type="button" @click="pendingSourceId = null">取消</button></div>
        <div class="workflow-canvas-controls" aria-label="画板缩放工具">
          <button v-if="selectedEdgeId" type="button" class="danger" aria-label="删除选中的连线" @click="removeSelectedEdge">删线</button>
          <button type="button" aria-label="缩小画板" @click="zoomOut()">−</button>
          <button type="button" aria-label="放大画板" @click="zoomIn()">＋</button>
          <button type="button" aria-label="适配全部节点" @click="fitView({ padding: 0.24 })">适配</button>
        </div>
      </VueFlow>
      <template #fallback><div class="workflow-canvas-loading">正在加载画板…</div></template>
    </ClientOnly>
  </section>
</template>

<script setup lang="ts">
import { MarkerType, VueFlow, useVueFlow, type Edge, type Node } from '@vue-flow/core'
import { findAssetOperation } from '#shared/config/asset-operations'
import type { ProjectWorkspace, WorkflowOperationNode, WorkflowTrigger } from '#shared/types/asdp'

const props = defineProps<{
  trigger: WorkflowTrigger | null
  nodes: WorkflowOperationNode[]
  workspace: ProjectWorkspace
  selectedNodeId: string | null
}>()

const emit = defineEmits<{
  selectNode: [id: string | null]
  updatePosition: [id: string, position: { x: number, y: number }]
}>()

const { fitView, zoomIn, zoomOut } = useVueFlow({ id: 'workflow-definition-canvas' })
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
  return Boolean(assetLabel(node) && operation?.workflow.enabled && operation.contract.input.every(field =>
    !field.required || (node.inputs[field.name] !== undefined && node.inputs[field.name] !== ''),
  ))
}

const canvasNodes = computed<Node[]>(() => {
  const triggerDetails = props.trigger ? triggerLabels[props.trigger.kind] : null
  return [{
    id: 'workflow-trigger',
    type: 'trigger',
    position: props.trigger?.position || { x: 260, y: 80 },
    draggable: Boolean(props.trigger),
    selectable: false,
    data: {
      label: triggerDetails?.label || '请选择触发器',
      description: triggerDetails?.description || '从左侧节点库选择根触发器',
      configured: Boolean(props.trigger),
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
        order: index + 1,
      },
    }
  })]
})

const canvasEdges = computed<Edge[]>(() => {
  if (!props.trigger) return []
  const ids = ['workflow-trigger', ...props.nodes.map(node => node.id)]
  return ids.slice(0, -1).map((source, index) => ({
    id: `workflow-edge-${index}`,
    source,
    target: ids[index + 1],
    type: 'smoothstep',
    markerEnd: MarkerType.ArrowClosed,
    selectable: false,
  }))
})

const onNodeClick = ({ node }: { node: Node }) => emit('selectNode', node.id === 'workflow-trigger' ? null : node.id)
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
      <VueFlow id="workflow-definition-canvas" :nodes="canvasNodes" :edges="canvasEdges" :min-zoom="0.35" :max-zoom="1.6" :nodes-connectable="false" :edges-updatable="false" fit-view-on-init @node-click="onNodeClick" @node-drag-stop="onNodeDragStop" @pane-click="emit('selectNode', null)">
        <template #node-trigger="slotProps"><WorkflowTriggerNode v-bind="slotProps" /></template>
        <template #node-operation="slotProps"><WorkflowOperationNode v-bind="slotProps" /></template>
        <div class="workflow-canvas-controls" aria-label="画板缩放工具">
          <button type="button" aria-label="缩小画板" @click="zoomOut()">−</button>
          <button type="button" aria-label="放大画板" @click="zoomIn()">＋</button>
          <button type="button" aria-label="适配全部节点" @click="fitView({ padding: 0.24 })">适配</button>
        </div>
      </VueFlow>
      <template #fallback><div class="workflow-canvas-loading">正在加载画板…</div></template>
    </ClientOnly>
  </section>
</template>

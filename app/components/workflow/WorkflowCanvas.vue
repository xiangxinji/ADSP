<script setup lang="ts">
import { MarkerType, VueFlow, useVueFlow, type Edge, type Node } from '@vue-flow/core'
import type { ProjectWorkspace, WorkflowEdge, WorkflowNode, WorkflowTrigger } from '#shared/types/asdp'
import type { WorkflowRunStep } from '#shared/types/workflow-runs'
import { workflowTriggerNodeId } from '#shared/utils/workflow-graph'
import { workflowOutputPorts } from '#shared/utils/workflow-nodes'
import type { WorkflowConnectionSource } from '~/composables/useWorkflowCanvasNodes'

const props = defineProps<{
  trigger: WorkflowTrigger | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  workspace: ProjectWorkspace
  selectedNodeId: string | null
  runSteps?: WorkflowRunStep[]
  readOnly?: boolean
}>()
const emit = defineEmits<{
  selectNode: [id: string | null]
  updatePosition: [id: string, position: { x: number, y: number }]
  connectEdge: [connection: Pick<WorkflowEdge, 'source' | 'target' | 'sourceHandle'>]
  removeEdge: [id: string]
  addAsyncBranch: [nodeId: string]
  addExceptionPort: [nodeId: string]
}>()
const { fitView, zoomIn, zoomOut } = useVueFlow({ id: 'workflow-definition-canvas' })
const selectedEdgeId = ref<string | null>(null)
const pendingSource = ref<WorkflowConnectionSource | null>(null)
const canvasNodes = useWorkflowCanvasNodes(props, pendingSource)
const canvasEdges = computed<Edge[]>(() => props.edges.map(edge => ({
  ...edge, type: 'smoothstep', markerEnd: MarkerType.ArrowClosed,
  selected: selectedEdgeId.value === edge.id, selectable: true,
})))

const onNodeClick = ({ node }: { node: Node }) => {
  selectedEdgeId.value = null
  emit('selectNode', node.id === workflowTriggerNodeId ? null : node.id)
}
const onEdgeClick = ({ edge }: { edge: Edge }) => {
  if (props.readOnly) return
  selectedEdgeId.value = edge.id
  emit('selectNode', null)
}
const onConnect = (connection: { source?: string | null, target?: string | null, sourceHandle?: string | null }) => {
  if (props.readOnly) return
  if (connection.source && connection.target) emit('connectEdge', {
    source: connection.source, target: connection.target,
    ...(connection.sourceHandle ? { sourceHandle: connection.sourceHandle } : {}),
  })
  pendingSource.value = null
}
const selectConnectionSource = (source: string, sourceHandle?: string) => {
  if (props.readOnly) return
  pendingSource.value = pendingSource.value?.source === source && pendingSource.value?.sourceHandle === sourceHandle
    ? null : { source, ...(sourceHandle ? { sourceHandle } : {}) }
  selectedEdgeId.value = null
}
const selectConnectionTarget = (target: string) => {
  if (pendingSource.value) onConnect({ ...pendingSource.value, target })
}
const clearSelection = () => {
  selectedEdgeId.value = null
  pendingSource.value = null
  emit('selectNode', null)
}
const removeSelectedEdge = () => {
  if (!selectedEdgeId.value) return
  emit('removeEdge', selectedEdgeId.value)
  selectedEdgeId.value = null
}
const onNodeDragStop = ({ node }: { node: Node }) => {
  if (!props.readOnly) emit('updatePosition', node.id, { x: node.position.x, y: node.position.y })
}
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
watch(() => props.nodes, () => {
  const pending = pendingSource.value
  if (!pending || pending.source === workflowTriggerNodeId) return
  const source = props.nodes.find(node => node.id === pending.source)
  if (!source || !workflowOutputPorts(source).some(port => port.id === pending.sourceHandle)) pendingSource.value = null
}, { deep: true })
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
      <VueFlow
        id="workflow-definition-canvas" :nodes="canvasNodes" :edges="canvasEdges" :min-zoom="0.35" :max-zoom="1.6"
        :nodes-connectable="!readOnly" :nodes-draggable="!readOnly" :edges-updatable="false" :delete-key-code="null"
        fit-view-on-init @connect="onConnect" @node-click="onNodeClick" @edge-click="onEdgeClick"
        @node-drag-stop="onNodeDragStop" @pane-click="clearSelection"
      >
        <template #node-trigger="slotProps"><WorkflowTriggerNode v-bind="slotProps" @select-source="selectConnectionSource(slotProps.id)" /></template>
        <template #node-operation="slotProps">
          <WorkflowOperationNode
            v-bind="slotProps" @select-source="selectConnectionSource(slotProps.id, $event)"
            @select-target="selectConnectionTarget(slotProps.id)" @add-exception="emit('addExceptionPort', slotProps.id)"
          />
        </template>
        <template #node-async="slotProps">
          <WorkflowAsyncNode v-bind="slotProps" @select-source="selectConnectionSource(slotProps.id, $event)" @select-target="selectConnectionTarget(slotProps.id)" @add-branch="emit('addAsyncBranch', slotProps.id)" />
        </template>
        <div v-if="pendingSource" class="workflow-connection-status" role="status">已选择输出端点，请点击下游节点卡片或顶部圆点。<button type="button" @click="pendingSource = null">取消</button></div>
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

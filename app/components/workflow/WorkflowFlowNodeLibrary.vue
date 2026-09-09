<script setup lang="ts">
import type { WorkflowControlKind } from '#shared/types/asdp'
import { workflowControlNames } from '#shared/utils/workflow-nodes'
import type { AppIconName } from '~/types/ui'
import type { WorkflowNodeDragData } from '~/utils/workflow-node-drag'

const props = defineProps<{ enabled: boolean }>()
const emit = defineEmits<{
  addControlNode: [kind: WorkflowControlKind]
  addSubworkflow: []
  inspect: [node: { label: string, description: string } | null]
}>()
const { draggingId, startDrag, finishDrag } = useWorkflowLibraryDrag(() => props.enabled)
const nodes: { id: string, label: string, description: string, icon: AppIconName, tone: string, data: WorkflowNodeDragData }[] = [
  { id: 'workflow', label: '工作流', description: '执行另一个工作流，并查看内部节点的执行状态。', icon: 'workflow', tone: 'purple', data: { type: 'workflow' } },
  { id: 'sync', label: workflowControlNames.sync, description: '读取上游数组，按顺序逐项执行唯一子节点。', icon: 'versions', tone: 'blue', data: { type: 'control', kind: 'sync' } },
  { id: 'async', label: workflowControlNames.async, description: '读取上游数组，并发执行每个元素对应的唯一子节点。', icon: 'repository', tone: 'warning', data: { type: 'control', kind: 'async' } },
]
const addNode = (data: WorkflowNodeDragData) => {
  if (!props.enabled) return
  if (data.type === 'workflow') emit('addSubworkflow')
  else if (data.type === 'control') emit('addControlNode', data.kind)
}
</script>

<template>
  <section class="node-flow-library" aria-label="流程节点">
    <div class="node-library-section-heading"><h3>流程节点</h3><span>3</span></div>
    <div class="node-flow-grid">
      <button
        v-for="node in nodes" :key="node.id" type="button" class="node-flow-tile"
        :class="{ dragging: draggingId === node.id }" :disabled="!enabled" :draggable="enabled"
        :aria-label="'添加' + node.label" :aria-description="node.description" :title="node.description"
        aria-describedby="workflow-node-drag-help" @click="addNode(node.data)"
        @dragstart="startDrag($event, node.data, node.id)" @dragend="finishDrag"
        @mouseenter="emit('inspect', node)" @mouseleave="emit('inspect', null)"
        @focus="emit('inspect', node)" @blur="emit('inspect', null)"
      >
        <span class="node-library-symbol" :data-tone="node.tone"><AppIcon :name="node.icon" :size="18" /></span>
        <strong>{{ node.label }}</strong>
      </button>
    </div>
  </section>
</template>

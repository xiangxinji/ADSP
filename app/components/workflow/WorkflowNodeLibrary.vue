<script setup lang="ts">
import type { WorkflowTriggerKind } from '#shared/types/asdp'
import {
  serializeWorkflowNodeDragData,
  workflowNodeDragMime,
  type WorkflowNodeDragData,
  type WorkflowOperationSelection,
} from '~/utils/workflow-node-drag'

const props = defineProps<{
  triggerKind: WorkflowTriggerKind | null
}>()

const emit = defineEmits<{
  selectTrigger: [kind: WorkflowTriggerKind]
  addAsyncNode: []
  addOperation: [selection: WorkflowOperationSelection]
}>()

const triggerOptions: { kind: WorkflowTriggerKind, label: string, description: string }[] = [
  { kind: 'manual', label: '手动触发', description: '由操作人员输入 JSON 根数据并启动。' },
  { kind: 'requirement-created', label: '需求创建时', description: '为后续需求事件接入预留触发配置。' },
]

const draggingSource = ref('')

const startDrag = (event: DragEvent, data: WorkflowNodeDragData, source: string) => {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(workflowNodeDragMime, serializeWorkflowNodeDragData(data))
  draggingSource.value = source
}

const startAsyncDrag = (event: DragEvent) => {
  if (!props.triggerKind) return event.preventDefault()
  startDrag(event, { type: 'async' }, 'async')
}

</script>

<template>
  <aside class="workflow-sidebar workflow-library" aria-label="工作流节点库">
    <div class="workflow-sidebar-heading"><p class="overline">NODE LIBRARY</p><h2>节点库</h2><span id="workflow-node-drag-help">先选择根触发器，再将节点拖入画板；也可以点击添加。</span></div>
    <section class="workflow-library-section">
      <div class="workflow-library-title"><strong>1. 根触发器</strong><span>必须有且只能有一个</span></div>
      <div class="workflow-trigger-options">
        <button v-for="option in triggerOptions" :key="option.kind" type="button" :class="{ active: triggerKind === option.kind }" :aria-pressed="triggerKind === option.kind" @click="emit('selectTrigger', option.kind)">
          <span><AppIcon name="workflow" :size="16" /></span><span><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span><AppIcon v-if="triggerKind === option.kind" name="check" :size="14" />
        </button>
      </div>
    </section>
    <section class="workflow-library-section">
      <div class="workflow-library-title"><strong>2. 流程控制</strong><span>并发执行与结果分流</span></div>
      <p class="workflow-operation-help">动态添加子端点并发执行多个子流程，全部结束后走完成或异常出口。</p>
      <button
        type="button" class="workflow-node-template" :class="{ dragging: draggingSource === 'async' }"
        :disabled="!triggerKind" :draggable="Boolean(triggerKind)" aria-describedby="workflow-node-drag-help"
        @click="emit('addAsyncNode')" @dragstart="startAsyncDrag" @dragend="draggingSource = ''"
      >
        <span class="workflow-node-template-icon"><AppIcon name="workflow" :size="16" /></span>
        <span class="workflow-node-template-copy"><strong>异步执行</strong><small>并发执行子流程</small></span>
        <span class="workflow-node-template-action">拖动</span>
      </button>
    </section>
    <WorkflowOperationLibrary :enabled="Boolean(triggerKind)" @add-operation="emit('addOperation', $event)" />
  </aside>
</template>

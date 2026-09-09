<script setup lang="ts">
import type { WorkflowControlKind, WorkflowTriggerKind } from '#shared/types/asdp'
import { workflowControlNames } from '#shared/utils/workflow-nodes'
import {
  serializeWorkflowNodeDragData,
  workflowNodeDragMime,
  type WorkflowNodeDragData,
  type WorkflowOperationSelection,
} from '~/utils/workflow-node-drag'

const controlKinds = ['sync', 'async'] as const

const props = defineProps<{
  triggerKind: WorkflowTriggerKind | null
}>()

const emit = defineEmits<{
  selectTrigger: [kind: WorkflowTriggerKind]
  addControlNode: [kind: WorkflowControlKind]
  addOperation: [selection: WorkflowOperationSelection]
  addSubworkflow: []
}>()

const triggerOptions: { kind: WorkflowTriggerKind, label: string, description: string }[] = [
  { kind: 'manual', label: '手动触发', description: '由操作人员输入 JSON 根数据并启动。' },
  { kind: 'requirement-created', label: '需求创建时', description: '需求保存后进入触发队列并自动运行。' },
  { kind: 'requirement-status-changed', label: '需求状态变更时', description: '可在右侧指定一个或多个目标状态，传入需求 ID。' },
]

const draggingSource = ref('')

const startDrag = (event: DragEvent, data: WorkflowNodeDragData, source: string) => {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(workflowNodeDragMime, serializeWorkflowNodeDragData(data))
  draggingSource.value = source
}

const startControlDrag = (event: DragEvent, kind: WorkflowControlKind) => {
  if (!props.triggerKind) return event.preventDefault()
  startDrag(event, { type: 'control', kind }, `control:${kind}`)
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
      <div class="workflow-library-title"><strong>2. 流程节点</strong><span>顺序 / 并发执行与工作流复用</span></div>
      <p class="workflow-operation-help">自动读取上游数组，逐项执行唯一子节点；同步顺序执行，异步并发执行。</p>
      <div class="workflow-node-templates">
        <button
          type="button" class="workflow-node-template" :disabled="!triggerKind" :draggable="Boolean(triggerKind)"
          :class="{ dragging: draggingSource === 'workflow' }" aria-describedby="workflow-node-drag-help"
          @click="emit('addSubworkflow')" @dragstart="startDrag($event, { type: 'workflow' }, 'workflow')" @dragend="draggingSource = ''"
        >
          <span class="workflow-node-template-icon"><AppIcon name="workflow" :size="16" /></span>
          <span class="workflow-node-template-copy"><strong>工作流</strong><small>执行另一个工作流，查看内部状态</small></span>
          <span class="workflow-node-template-action">拖动</span>
        </button>
        <button
          v-for="kind in controlKinds" :key="kind" type="button" class="workflow-node-template"
          :class="{ dragging: draggingSource === `control:${kind}` }" :disabled="!triggerKind" :draggable="Boolean(triggerKind)"
          aria-describedby="workflow-node-drag-help" @click="emit('addControlNode', kind)"
          @dragstart="startControlDrag($event, kind)" @dragend="draggingSource = ''"
        >
          <span class="workflow-node-template-icon"><AppIcon name="workflow" :size="16" /></span>
          <span class="workflow-node-template-copy"><strong>{{ workflowControlNames[kind] }}</strong><small>{{ kind === 'sync' ? '按数组顺序逐项执行' : '按数组元素并发执行' }}</small></span>
          <span class="workflow-node-template-action">拖动</span>
        </button>
      </div>
    </section>
    <WorkflowOperationLibrary :enabled="Boolean(triggerKind)" @add-operation="emit('addOperation', $event)" />
  </aside>
</template>

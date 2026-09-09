<script setup lang="ts">
import { assetOperationConfig } from '#shared/config/asset-operations'
import type { AssetType } from '#shared/types/asset-operations'
import { serializeWorkflowNodeDragData, workflowNodeDragMime, type WorkflowOperationSelection } from '~/utils/workflow-node-drag'

const props = defineProps<{ enabled: boolean }>()
const emit = defineEmits<{ addOperation: [selection: WorkflowOperationSelection] }>()
const search = ref('')
const draggingOperationId = ref('')
const typeNames: Record<AssetType, string> = { repository: '仓库', member: '成员', environment: '环境', knowledge: '知识' }
const operations = assetOperationConfig.modules.flatMap(module => module.operations
  .filter(operation => operation.workflow.enabled)
  .map(operation => ({ ...operation, label: typeNames[module.assetType] + operation.label, assetType: module.assetType })))
const filteredOperations = computed(() => {
  const query = search.value.trim().toLowerCase()
  return operations.filter(operation => `${operation.label} ${operation.id} ${operation.description}`.toLowerCase().includes(query))
})
const selectionFor = (operation: typeof operations[number]): WorkflowOperationSelection => ({
  assetType: operation.assetType, operationId: operation.id,
})
const startDrag = (event: DragEvent, operation: typeof operations[number]) => {
  if (!props.enabled || !event.dataTransfer) return event.preventDefault()
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(workflowNodeDragMime, serializeWorkflowNodeDragData({ type: 'operation', selection: selectionFor(operation) }))
  draggingOperationId.value = operation.id
}
</script>

<template>
  <section class="workflow-library-section" aria-label="资产操作库">
    <div class="workflow-library-title"><strong>3. 资产操作</strong><span>{{ operations.length }} 个操作</span></div>
    <p class="workflow-operation-help">直接拖入画板，默认使用输入值；固定资产可在节点内配置。</p>
    <AppFormField field-id="workflow-operation-search" label="搜索操作">
      <AppInput id="workflow-operation-search" v-model="search" type="search" placeholder="例如：仓库克隆" />
    </AppFormField>
    <div class="workflow-node-templates">
      <button
        v-for="operation in filteredOperations" :key="operation.id" type="button" class="workflow-node-template operation"
        :class="{ dragging: draggingOperationId === operation.id }" :disabled="!enabled" :draggable="enabled"
        :aria-label="'添加' + operation.label" :title="operation.description" aria-describedby="workflow-node-drag-help"
        @click="emit('addOperation', selectionFor(operation))" @dragstart="startDrag($event, operation)" @dragend="draggingOperationId = ''"
      >
        <span class="workflow-node-template-icon"><AppIcon :name="operation.icon" :size="16" /></span>
        <span class="workflow-node-template-copy"><strong>{{ operation.label }}</strong><small>{{ operation.description }}</small></span>
        <span class="workflow-node-template-action">拖动</span>
      </button>
    </div>
    <p v-if="!filteredOperations.length" class="workflow-library-empty compact">没有匹配的操作，请尝试其他关键词。</p>
  </section>
</template>

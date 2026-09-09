<script setup lang="ts">
import { workflowOperationGroups } from '~/utils/workflow-operation-library'
import { serializeWorkflowNodeDragData, workflowNodeDragMime, type WorkflowOperationSelection } from '~/utils/workflow-node-drag'

const props = defineProps<{ enabled: boolean }>()
const emit = defineEmits<{ addOperation: [selection: WorkflowOperationSelection] }>()
const search = ref('')
const draggingOperationId = ref('')
const groups = computed(() => workflowOperationGroups(search.value))
const operationCount = workflowOperationGroups().reduce((count, group) => count + group.operations.length, 0)
type LibraryOperation = ReturnType<typeof workflowOperationGroups>[number]['operations'][number]
const selectionFor = (operation: LibraryOperation): WorkflowOperationSelection => ({
  assetType: operation.assetType, operationId: operation.id,
})
const startDrag = (event: DragEvent, operation: LibraryOperation) => {
  if (!props.enabled || !event.dataTransfer) return event.preventDefault()
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(workflowNodeDragMime, serializeWorkflowNodeDragData({ type: 'operation', selection: selectionFor(operation) }))
  draggingOperationId.value = operation.id
}
</script>

<template>
  <section class="workflow-library-section" aria-label="资产操作库">
    <div class="workflow-library-title"><strong>3. 资产操作</strong><span>{{ operationCount }} 个操作</span></div>
    <p class="workflow-operation-help">按资产类型分组，直接拖入画板。“获取全部”自动读取当前项目；其他操作可配置输入值或固定资产。</p>
    <AppFormField field-id="workflow-operation-search" label="搜索操作">
      <AppInput id="workflow-operation-search" v-model="search" type="search" placeholder="例如：仓库克隆" />
    </AppFormField>
    <section v-for="group in groups" :key="group.assetType" class="workflow-operation-group" :aria-label="group.label + '操作'">
      <div class="workflow-library-title"><strong>{{ group.label }}</strong><span>{{ group.operations.length }} 个操作</span></div>
      <div class="workflow-node-templates">
      <button
        v-for="operation in group.operations" :key="operation.id" type="button" class="workflow-node-template operation"
        :class="{ dragging: draggingOperationId === operation.id }" :disabled="!enabled" :draggable="enabled"
        :aria-label="'添加' + operation.label" :title="operation.description" aria-describedby="workflow-node-drag-help"
        @click="emit('addOperation', selectionFor(operation))" @dragstart="startDrag($event, operation)" @dragend="draggingOperationId = ''"
      >
        <span class="workflow-node-template-icon"><AppIcon :name="operation.icon" :size="16" /></span>
        <span class="workflow-node-template-copy"><strong>{{ operation.label }}</strong><small>{{ operation.description }}</small></span>
        <span class="workflow-node-template-action">拖动</span>
      </button>
      </div>
    </section>
    <p v-if="!groups.length" class="workflow-library-empty compact">没有匹配的操作，请尝试其他关键词。</p>
  </section>
</template>

<style scoped>
.workflow-operation-group + .workflow-operation-group {
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--line);
}
</style>

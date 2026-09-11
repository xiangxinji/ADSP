<script setup lang="ts">
import type { AssetType } from '#shared/types/asdp'
import type { AppIconName } from '~/types/ui'
import type { workflowOperationGroups } from '~/utils/workflow-operation-library'
import type { WorkflowOperationSelection } from '~/utils/workflow-node-drag'

const props = defineProps<{ enabled: boolean }>()
const emit = defineEmits<{
  addOperation: [selection: WorkflowOperationSelection]
  inspect: [node: { label: string, description: string } | null]
}>()
const { search, category, categories, groups, operationCount, resultCount, isExpanded, toggleGroup, resetFilters } = useWorkflowOperationLibrary()
const { draggingId, startDrag, finishDrag } = useWorkflowLibraryDrag(() => props.enabled)
const categoryIcons: Record<AssetType, AppIconName> = {
  repository: 'repository', member: 'members', environment: 'environment', knowledge: 'knowledge',
  'ai-interface': 'ai',
}
type LibraryOperation = ReturnType<typeof workflowOperationGroups>[number]['operations'][number]
const selectionFor = (operation: LibraryOperation): WorkflowOperationSelection => ({
  assetType: operation.assetType, operationId: operation.id,
})
</script>

<template>
  <section class="node-operation-library" aria-label="资产操作库">
    <div class="node-library-section-heading"><h3>资产操作</h3><span>{{ operationCount }}</span></div>
    <div class="node-library-search">
      <AppIcon name="search" :size="15" />
      <AppInput
        id="workflow-operation-search" v-model="search" type="search" aria-label="搜索资产操作"
        placeholder="搜索名称、功能或操作 ID" autocomplete="off" @keydown.esc.stop="search = ''"
      />
    </div>
    <div class="node-library-categories" role="group" aria-label="筛选资产类型">
      <button type="button" :aria-pressed="category === 'all'" @click="category = 'all'">全部</button>
      <button
        v-for="item in categories" :key="item.assetType" type="button"
        :aria-pressed="category === item.assetType" @click="category = item.assetType"
      >{{ item.label }}</button>
    </div>
    <div v-if="search.trim() || category !== 'all'" class="node-library-results" aria-live="polite" role="status">
      <span>{{ search.trim() ? '搜索结果' : category === 'all' ? '全部操作' : '当前分类' }}</span>
      <span>{{ resultCount }} 个操作</span>
    </div>
    <div class="node-operation-scroll">
      <section v-for="group in groups" :key="group.assetType" class="node-operation-group" :aria-label="group.label + '操作'">
        <button
          type="button" class="node-operation-group-heading" :aria-expanded="isExpanded(group.assetType)"
          :aria-controls="'node-operations-' + group.assetType" :disabled="Boolean(search.trim())"
          @click="toggleGroup(group.assetType)"
        >
          <AppIcon :name="categoryIcons[group.assetType]" :size="15" />
          <strong>{{ group.label }}</strong><span>{{ group.operations.length }}</span>
          <span class="node-library-chevron" :class="{ expanded: isExpanded(group.assetType) }" aria-hidden="true">›</span>
        </button>
        <div v-show="isExpanded(group.assetType)" :id="'node-operations-' + group.assetType" class="node-operation-rows">
          <button
            v-for="operation in group.operations" :key="operation.id" type="button" class="node-operation-row"
            :class="{ dragging: draggingId === operation.id }" :data-asset-type="group.assetType"
            :disabled="!enabled" :draggable="enabled" :aria-label="'添加' + operation.label"
            :aria-description="operation.description" :title="operation.label + '：' + operation.description"
            aria-describedby="workflow-node-drag-help" @click="emit('addOperation', selectionFor(operation))"
            @dragstart="startDrag($event, { type: 'operation', selection: selectionFor(operation) }, operation.id)" @dragend="finishDrag"
            @mouseenter="emit('inspect', operation)" @mouseleave="emit('inspect', null)"
            @focus="emit('inspect', operation)" @blur="emit('inspect', null)"
          >
            <span class="node-library-symbol"><AppIcon :name="operation.icon" :size="15" /></span>
            <span class="node-operation-label">{{ operation.displayLabel }}</span>
            <AppIcon class="node-operation-add" name="add" :size="14" />
          </button>
        </div>
      </section>
      <div v-if="!groups.length" class="node-library-no-results">
        <AppIcon name="search" :size="24" />
        <strong>没有匹配的操作</strong>
        <p>试试其他关键词，或切换资产分类。</p>
        <button type="button" @click="resetFilters">重置筛选</button>
      </div>
    </div>
  </section>
</template>

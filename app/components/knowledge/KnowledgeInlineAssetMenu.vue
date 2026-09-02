<script setup lang="ts">
import type { KnowledgeAssetReferenceOption } from '~/editor/knowledge-asset-reference'
import type { InlineAssetMenuState } from '~/composables/useInlineAssetSlashMenu'

defineProps<{
  menu: InlineAssetMenuState | null
  query: string
  options: KnowledgeAssetReferenceOption[]
  activeIndex: number
  hasReferences: boolean
}>()

const emit = defineEmits<{
  select: [option: KnowledgeAssetReferenceOption]
  'update:activeIndex': [index: number]
}>()
const root = ref<HTMLDivElement | null>(null)
const scrollActiveIntoView = () => root.value?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })

defineExpose({ scrollActiveIntoView })
</script>

<template>
  <Teleport to="body">
    <div v-if="menu" ref="root" class="knowledge-inline-slash-menu" :style="{ left: `${menu.left}px`, top: `${menu.top}px` }" role="listbox" aria-label="快捷添加资产">
      <header><span>资产引用</span><small v-if="query">“{{ query }}”</small></header>
      <div v-if="options.length" class="knowledge-inline-slash-options">
        <button v-for="(option, index) in options" :key="`${option.targetType}-${option.recordId}`" type="button" role="option" :aria-selected="activeIndex === index" @pointerenter="emit('update:activeIndex', index)" @pointerdown.prevent @click="emit('select', option)">
          <span>{{ option.typeLabel }}</span><strong>{{ option.label }}</strong><small>{{ option.detail }}</small>
        </button>
      </div>
      <p v-else>{{ hasReferences ? '没有匹配的资产' : '暂无可引用资产' }}</p>
    </div>
  </Teleport>
</template>

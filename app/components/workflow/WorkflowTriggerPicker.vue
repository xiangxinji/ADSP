<script setup lang="ts">
import type { WorkflowTriggerKind } from '#shared/types/asdp'
import type { AppIconName } from '~/types/ui'

const props = defineProps<{ triggerKind: WorkflowTriggerKind | null }>()
const emit = defineEmits<{ select: [kind: WorkflowTriggerKind] }>()
const expanded = ref(!props.triggerKind)
const summary = ref<HTMLButtonElement | null>(null)
const triggerOptions: { kind: WorkflowTriggerKind, label: string, description: string, icon: AppIconName }[] = [
  { kind: 'manual', label: '手动触发', description: '输入 JSON 根数据，由操作人员启动。', icon: 'play' },
  { kind: 'requirement-created', label: '需求创建时', description: '需求保存后自动进入触发队列。', icon: 'add' },
  { kind: 'requirement-status-changed', label: '需求状态变更时', description: '在右侧指定目标状态，传入需求 ID。', icon: 'status' },
]
const selected = computed(() => triggerOptions.find(option => option.kind === props.triggerKind))
const selectTrigger = (kind: WorkflowTriggerKind) => {
  emit('select', kind)
  expanded.value = false
  summary.value?.focus()
}
watch(() => props.triggerKind, kind => { if (!kind) expanded.value = true })
</script>

<template>
  <section class="node-trigger-picker" aria-label="根触发器">
    <button
      ref="summary" type="button" class="node-trigger-summary"
      :aria-expanded="expanded" aria-controls="node-trigger-options" @click="expanded = !expanded"
    >
      <span class="node-library-symbol" data-tone="success"><AppIcon :name="selected?.icon || 'play'" :size="16" /></span>
      <span class="node-trigger-copy"><small>根触发器 <span>· 唯一入口</span></small><strong>{{ selected?.label || '选择启动方式' }}</strong></span>
      <span class="node-library-chevron" :class="{ expanded }" aria-hidden="true">›</span>
    </button>
    <div v-show="expanded" id="node-trigger-options" class="node-trigger-options">
      <button
        v-for="option in triggerOptions" :key="option.kind" type="button"
        :aria-pressed="triggerKind === option.kind" @click="selectTrigger(option.kind)"
      >
        <AppIcon :name="option.icon" :size="15" />
        <span><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span>
        <AppIcon v-if="triggerKind === option.kind" name="check" :size="14" />
      </button>
    </div>
  </section>
</template>

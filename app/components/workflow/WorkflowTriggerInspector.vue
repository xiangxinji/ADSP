<script setup lang="ts">
import type { RequirementStatus, WorkflowTrigger } from '#shared/types/asdp'

const props = defineProps<{
  trigger: WorkflowTrigger
  statuses: RequirementStatus[]
}>()
const emit = defineEmits<{ updateStatusIds: [statusIds: string[] | undefined] }>()
const scope = computed(() => props.trigger.statusIds === undefined ? 'all' : 'selected')
const statusOptions = computed(() => {
  const knownIds = new Set(props.statuses.map(status => status.id))
  const missing = (props.trigger.statusIds || []).filter(id => !knownIds.has(id))
  return [
    ...props.statuses.map(status => ({ id: status.id, name: status.name, color: status.color })),
    ...missing.map(id => ({ id, name: `已删除状态 ${id}`, color: 'var(--muted)' })),
  ]
})
const setScope = (value: string | number | null | undefined) => {
  emit('updateStatusIds', value === 'all' ? undefined : props.trigger.statusIds || [])
}
const toggleStatus = (statusId: string, checked: boolean) => {
  const selected = new Set(props.trigger.statusIds || [])
  if (checked) selected.add(statusId)
  else selected.delete(statusId)
  emit('updateStatusIds', [...selected])
}
</script>

<template>
  <section class="workflow-inspector-section" aria-label="触发器配置">
    <div class="workflow-library-title"><strong>触发器配置</strong><span>需求状态变更时</span></div>
    <AppFormField field-id="workflow-trigger-status-scope" label="触发范围">
      <AppSelect id="workflow-trigger-status-scope" :model-value="scope" @update:model-value="setScope">
        <option value="all">任意状态</option>
        <option value="selected">指定状态（可多选）</option>
      </AppSelect>
    </AppFormField>
    <p class="workflow-operation-help">按变更后的状态匹配。仅修改其他字段或重复保存同一状态，不会触发。</p>
    <fieldset v-if="scope === 'selected'" class="workflow-trigger-status-options">
      <legend>目标状态（至少选择一项）</legend>
      <label v-for="status in statusOptions" :key="status.id" :class="{ checked: trigger.statusIds?.includes(status.id) }">
        <AppCheckbox
          :model-value="trigger.statusIds?.includes(status.id) || false"
          @update:model-value="toggleStatus(status.id, Boolean($event))"
        />
        <span class="workflow-trigger-status-color" :style="{ background: status.color }" aria-hidden="true" />
        <span>{{ status.name }}</span>
      </label>
    </fieldset>
    <p v-if="scope === 'selected' && !trigger.statusIds?.length" class="workflow-operation-help" role="alert">请选择至少一个目标状态后保存。</p>
    <p class="workflow-operation-help">触发后通过 <code>$root.requirementId</code> 传入需求 ID。</p>
  </section>
</template>

<style scoped>
.workflow-trigger-status-options {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  border: 0;
}
.workflow-trigger-status-options legend {
  margin-bottom: var(--space-2);
  color: var(--muted);
  font-size: var(--font-size-sm);
}
.workflow-trigger-status-options label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  overflow-wrap: anywhere;
}
.workflow-trigger-status-options label.checked {
  background: var(--blue-soft);
}
.workflow-trigger-status-color {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>

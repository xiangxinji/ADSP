<script setup lang="ts">
import type { AssetOperationField } from '#shared/types/asset-operations'
import type { WorkflowOperationInputValue } from '#shared/types/asdp'
import { parseWorkflowValueReference } from '#shared/utils/workflow-values'

const props = defineProps<{
  field: AssetOperationField
  modelValue: WorkflowOperationInputValue | undefined
  previousFields: readonly AssetOperationField[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: WorkflowOperationInputValue] }>()
const fieldId = computed(() => 'workflow-input-' + props.field.name)
const reference = computed(() => parseWorkflowValueReference(props.modelValue))
const source = computed(() => {
  if (reference.value) return reference.value.source
  if (typeof props.modelValue === 'string' && props.modelValue.trim().startsWith('$prev.')) return 'prev'
  if (typeof props.modelValue === 'string' && props.modelValue.trim().startsWith('$root.')) return 'root'
  return 'literal'
})
const path = computed(() => {
  if (reference.value) return reference.value.path.join('.')
  if (typeof props.modelValue !== 'string') return ''
  const match = props.modelValue.trim().match(/^\$(?:root|prev)\.(.*)$/)
  return match?.[1] || ''
})
const changeSource = (value: string) => {
  if (value === 'literal') {
    emit('update:modelValue', props.field.type === 'boolean' ? false : '')
    return
  }
  emit('update:modelValue', `$${value}.`)
}
const changePath = (value: unknown) => emit('update:modelValue', `$${source.value}.${String(value || '')}`)
</script>

<template>
  <AppFormField :field-id="fieldId" :label="`${field.name} · ${field.type}`" :hint="field.description">
    <AppSelect :id="fieldId + '-source'" :model-value="source" :aria-label="field.name + ' 的取值方式'" @update:model-value="changeSource(String($event))">
      <option value="literal">固定值</option>
      <option value="prev">上一份输出 · $prev</option>
      <option value="root">根节点输出 · $root</option>
    </AppSelect>
    <label v-if="source === 'literal' && field.type === 'boolean'" class="workflow-boolean-input">
      <AppCheckbox :model-value="Boolean(modelValue)" @update:model-value="emit('update:modelValue', Boolean($event))" />启用
    </label>
    <AppInput
      v-else-if="source === 'literal'" :id="fieldId" :model-value="String(modelValue || '')"
      :required="field.required" @update:model-value="emit('update:modelValue', String($event || ''))"
    />
    <template v-else>
      <AppInput
        :id="fieldId" :model-value="path" :list="source === 'prev' ? fieldId + '-outputs' : undefined"
        placeholder="例如 repository.branch" required @update:model-value="changePath"
      />
      <datalist v-if="source === 'prev'" :id="fieldId + '-outputs'">
        <option v-for="output in previousFields" :key="output.name" :value="output.name">{{ output.description }}</option>
      </datalist>
      <small class="workflow-value-reference-preview">{{ `$${source}.${path || 'xxx'}` }}</small>
    </template>
  </AppFormField>
</template>

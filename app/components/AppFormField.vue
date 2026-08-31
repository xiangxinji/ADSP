<script setup lang="ts">
defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  fieldId?: string
  label?: string
  hint?: string
}>(), {
  fieldId: undefined,
  label: '',
  hint: '',
})
</script>

<template>
  <div v-bind="$attrs" class="field">
    <label v-if="label || $slots.label" :for="fieldId">
      <slot name="label">{{ label }}</slot>
    </label>
    <slot />
    <small v-if="hint || $slots.hint"><slot name="hint">{{ hint }}</slot></small>
  </div>
</template>

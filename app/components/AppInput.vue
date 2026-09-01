<script setup lang="ts">
import type { AppControlSize } from '~/types/ui'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  size?: AppControlSize
}>(), {
  size: 'md',
})

const [model, modifiers] = defineModel<string | number | null | undefined, 'number' | 'trim'>({
  set(value) {
    if (modifiers.trim && typeof value === 'string') return value.trim()
    if (modifiers.number && typeof value === 'string' && value !== '') {
      const numberValue = Number(value)
      return Number.isNaN(numberValue) ? value : numberValue
    }
    return value
  },
})
</script>

<template>
  <input v-model="model" v-bind="$attrs" class="app-control" :data-size="size" />
</template>

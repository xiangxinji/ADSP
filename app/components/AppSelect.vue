<script setup lang="ts">
import type { AppControlSize } from '~/types/ui'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  size?: AppControlSize
}>(), {
  size: 'md',
})

const model = defineModel<string | number | null | undefined>()
</script>

<template>
  <select v-model="model" v-bind="$attrs" class="app-control" :data-size="size">
    <slot />
  </select>
</template>

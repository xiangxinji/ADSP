<script setup lang="ts">
import type { AppControlSize } from '~/types/ui'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  size?: AppControlSize
}>(), {
  size: 'md',
})

const model = defineModel<string | null | undefined>()
</script>

<template>
  <textarea v-model="model" v-bind="$attrs" class="app-control app-textarea" :data-size="size" />
</template>

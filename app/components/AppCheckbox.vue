<script setup lang="ts">
import type { AppControlSize } from '~/types/ui'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  size?: AppControlSize
}>(), {
  size: 'md',
})

type CheckboxModel = boolean | Array<string | number>

const model = defineModel<CheckboxModel>()
</script>

<template>
  <input v-model="model" v-bind="$attrs" class="app-checkbox" :data-size="size" type="checkbox" />
</template>

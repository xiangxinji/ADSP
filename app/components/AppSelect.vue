<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const model = defineModel<string | number | null | undefined>()
</script>

<template>
  <select v-model="model" v-bind="$attrs">
    <slot />
  </select>
</template>

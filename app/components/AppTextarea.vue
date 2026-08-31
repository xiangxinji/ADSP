<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const model = defineModel<string | null | undefined>()
</script>

<template>
  <textarea v-model="model" v-bind="$attrs" />
</template>

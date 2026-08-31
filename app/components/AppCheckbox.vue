<script setup lang="ts">
defineOptions({ inheritAttrs: false })

type CheckboxModel = boolean | Array<string | number>

const model = defineModel<CheckboxModel>()
</script>

<template>
  <input v-model="model" v-bind="$attrs" type="checkbox" />
</template>

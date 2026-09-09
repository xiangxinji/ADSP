<script setup lang="ts">
import type { AssetOperationField } from '#shared/types/asset-operations'

withDefaults(defineProps<{ fields: readonly AssetOperationField[], prefix?: string }>(), { prefix: '' })
</script>

<template>
  <ul class="asset-contract-fields">
    <li v-for="field in fields" :key="field.name">
      <code>{{ prefix + field.name }}: {{ field.type }}{{ field.nullable ? ' | null' : '' }}</code>
      <em v-if="field.required">必填</em><span>{{ field.description }}</span>
      <AssetContractFields v-if="field.fields" :fields="field.fields" :prefix="prefix + field.name + (field.type === 'object[]' ? '[].' : '.')" />
    </li>
  </ul>
</template>

<style scoped>
.asset-contract-fields {
  margin: 6px 0;
  padding-left: 14px;
  list-style: none;
}
.asset-contract-fields li {
  margin: 5px 0;
  overflow-wrap: anywhere;
  font-size: 11px;
}
.asset-contract-fields code,
.asset-contract-fields span {
  display: block;
}
.asset-contract-fields span {
  color: var(--muted);
}
.asset-contract-fields em {
  font-size: 10px;
}
</style>

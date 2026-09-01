<script setup lang="ts">
import type { AssetOperationDefinition } from '#shared/types/asset-operations'

defineProps<{
  operations: readonly AssetOperationDefinition[]
}>()
</script>

<template>
  <section class="asset-operation-catalog" aria-labelledby="asset-operation-catalog-title">
    <div class="asset-operation-catalog-heading">
      <div>
        <strong id="asset-operation-catalog-title">可用操作</strong>
        <span>由资产操作配置统一提供</span>
      </div>
      <small v-if="operations.some(operation => operation.workflow.enabled)">支持工作流编排</small>
    </div>
    <div class="asset-operation-catalog-list">
      <div v-for="operation in operations" :key="operation.id" class="asset-operation-summary">
        <span class="asset-operation-summary-icon"><AppIcon :name="operation.icon" :size="15" /></span>
        <span class="asset-operation-summary-copy">
          <strong>{{ operation.label }}</strong>
          <small>{{ operation.description }}</small>
        </span>
        <em v-if="operation.workflow.enabled">可编排</em>
      </div>
    </div>
  </section>
</template>

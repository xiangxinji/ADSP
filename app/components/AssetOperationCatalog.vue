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
        <div class="asset-operation-summary-copy">
          <strong>{{ operation.label }}</strong>
          <small>{{ operation.description }}</small>
          <details v-if="operation.execution.kind === 'command'" class="asset-operation-contract">
            <summary>参数、返回与异常</summary>
            <div class="asset-operation-contract-section">
              <b>输入</b>
              <ul>
                <li v-for="field in operation.contract.input" :key="field.name"><code>{{ field.name }}: {{ field.type }}</code><em v-if="field.required">必填</em><span>{{ field.description }}</span></li>
              </ul>
            </div>
            <div class="asset-operation-contract-section">
              <b>返回</b>
              <ul>
                <li v-for="field in operation.contract.output" :key="field.name"><code>{{ field.name }}: {{ field.type }}</code><span>{{ field.description }}</span></li>
              </ul>
            </div>
            <div class="asset-operation-contract-section">
              <b>异常</b>
              <ul>
                <li v-for="exception in operation.contract.exceptions" :key="exception.code"><code>{{ exception.code }}</code><span>{{ exception.description }}</span></li>
              </ul>
            </div>
          </details>
        </div>
        <em v-if="operation.workflow.enabled">可编排</em>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data: {
    label: string
    assetLabel: string
    description: string
    complete: boolean
    order: number
  }
}>()
</script>

<template>
  <div class="workflow-flow-node operation-node" :class="{ incomplete: !data.complete }">
    <Handle type="target" :position="Position.Top" aria-label="连接上游节点" />
    <span class="workflow-node-order">{{ data.order }}</span>
    <div><small>资产操作</small><strong>{{ data.label }}</strong><p>{{ data.assetLabel }}</p></div>
    <span v-if="!data.complete" class="workflow-node-warning">待配置</span>
    <Handle type="source" :position="Position.Bottom" aria-label="连接下游节点" />
  </div>
</template>

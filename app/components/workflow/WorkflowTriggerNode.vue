<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data: {
    label: string
    description: string
    configured: boolean
    connected: boolean
  }
}>()
</script>

<template>
  <div class="workflow-flow-node trigger-node" :class="{ incomplete: !data.configured }">
    <span class="workflow-node-icon"><AppIcon name="workflow" :size="18" /></span>
    <div><small>根触发器 · 必须</small><strong>{{ data.label }}</strong><p>{{ data.description }}</p></div>
    <span v-if="data.configured && !data.connected" class="workflow-node-warning">待连线</span>
    <Handle type="source" :position="Position.Bottom" :connectable="data.configured" aria-label="从根触发器连接下游节点" />
  </div>
</template>

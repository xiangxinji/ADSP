<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data: {
    label: string
    description: string
    configured: boolean
    connected: boolean
    connectionSource: boolean
  }
}>()

const emit = defineEmits<{ selectSource: [] }>()
</script>

<template>
  <div class="workflow-flow-node trigger-node" :class="{ incomplete: !data.configured }">
    <span class="workflow-node-icon"><AppIcon name="workflow" :size="18" /></span>
    <div><small>根触发器 · 必须</small><strong>{{ data.label }}</strong><p>{{ data.description }}</p></div>
    <span v-if="data.configured && !data.connected" class="workflow-node-warning">待连线</span>
    <Handle
      type="source"
      :position="Position.Bottom"
      :connectable="data.configured"
      :class="{ 'click-source-active': data.connectionSource }"
      role="button"
      tabindex="0"
      aria-label="选择根触发器作为连线起点"
      @click.stop="emit('selectSource')"
      @keydown.enter.stop.prevent="emit('selectSource')"
      @keydown.space.stop.prevent="emit('selectSource')"
    />
  </div>
</template>

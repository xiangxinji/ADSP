<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data: {
    label: string
    assetLabel: string
    description: string
    complete: boolean
    order: number
    connectionSource: boolean
    awaitingTarget: boolean
  }
}>()

const emit = defineEmits<{
  selectSource: []
  selectTarget: []
}>()
</script>

<template>
  <div class="workflow-flow-node operation-node" :class="{ incomplete: !data.complete }">
    <Handle
      type="target"
      :position="Position.Top"
      :class="{ 'click-target-ready': data.awaitingTarget }"
      role="button"
      tabindex="0"
      aria-label="选择当前节点作为连线终点"
      @click.stop="emit('selectTarget')"
      @keydown.enter.stop.prevent="emit('selectTarget')"
      @keydown.space.stop.prevent="emit('selectTarget')"
    />
    <span class="workflow-node-order">{{ data.order }}</span>
    <div><small>资产操作</small><strong>{{ data.label }}</strong><p>{{ data.assetLabel }}</p></div>
    <span v-if="!data.complete" class="workflow-node-warning">待配置</span>
    <Handle
      type="source"
      :position="Position.Bottom"
      :class="{ 'click-source-active': data.connectionSource }"
      role="button"
      tabindex="0"
      aria-label="选择当前节点作为连线起点"
      @click.stop="emit('selectSource')"
      @keydown.enter.stop.prevent="emit('selectSource')"
      @keydown.space.stop.prevent="emit('selectSource')"
    />
  </div>
</template>

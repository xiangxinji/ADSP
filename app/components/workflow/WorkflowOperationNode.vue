<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { workflowRunStatusLabels } from '#shared/config/workflow-run-status'
import type { WorkflowStepStatus } from '#shared/types/workflow-runs'

defineProps<{
  data: {
    label: string
    assetLabel: string
    description: string
    complete: boolean
    order: number
    connectionSource: boolean
    awaitingTarget: boolean
    runStatus?: WorkflowStepStatus
    readOnly?: boolean
  }
}>()

const emit = defineEmits<{
  selectSource: []
  selectTarget: []
}>()
</script>

<template>
  <div
    class="workflow-flow-node operation-node"
    :class="{ incomplete: !data.complete, 'connection-target-ready': data.awaitingTarget }"
    :data-run-status="data.runStatus"
    :role="data.awaitingTarget ? 'button' : undefined"
    :tabindex="data.awaitingTarget ? 0 : undefined"
    @click="data.awaitingTarget && emit('selectTarget')"
    @keydown.enter.stop.prevent="data.awaitingTarget && emit('selectTarget')"
    @keydown.space.stop.prevent="data.awaitingTarget && emit('selectTarget')"
  >
    <Handle
      type="target"
      :position="Position.Top"
      :class="{ 'click-target-ready': data.awaitingTarget }"
      role="button"
      :tabindex="data.readOnly ? -1 : 0"
      aria-label="选择当前节点作为连线终点"
      @click.stop="emit('selectTarget')"
      @keydown.enter.stop.prevent="emit('selectTarget')"
      @keydown.space.stop.prevent="emit('selectTarget')"
    />
    <span class="workflow-node-order">{{ data.order }}</span>
    <div><small>资产操作</small><strong>{{ data.label }}</strong><p>{{ data.assetLabel }}</p></div>
    <span v-if="data.runStatus" class="workflow-node-run-status workflow-run-status" :data-status="data.runStatus">{{ workflowRunStatusLabels[data.runStatus] }}</span>
    <span v-else-if="!data.complete" class="workflow-node-warning">待配置</span>
    <span v-if="data.awaitingTarget" class="workflow-node-connect-prompt">点击节点完成连线</span>
    <Handle
      type="source"
      :position="Position.Bottom"
      :class="{ 'click-source-active': data.connectionSource }"
      role="button"
      :tabindex="data.readOnly ? -1 : 0"
      aria-label="选择当前节点作为连线起点"
      @click.stop="emit('selectSource')"
      @keydown.enter.stop.prevent="emit('selectSource')"
      @keydown.space.stop.prevent="emit('selectSource')"
    />
  </div>
</template>

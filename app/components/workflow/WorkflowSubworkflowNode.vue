<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { WorkflowStepStatus } from '#shared/types/workflow-runs'
import { workflowRunStatusLabels } from '#shared/config/workflow-run-status'

defineProps<{
  id: string
  data: {
    label: string
    workflowName: string
    complete: boolean
    order: number
    connectionSource: boolean
    awaitingTarget: boolean
    completedSteps: number
    totalSteps: number
    runStatus?: WorkflowStepStatus
    readOnly?: boolean
  }
}>()
const emit = defineEmits<{ selectSource: [], selectTarget: [] }>()
</script>

<template>
  <div
    class="workflow-flow-node workflow-call-node" :data-run-status="data.runStatus"
    :class="{ incomplete: !data.complete, 'connection-target-ready': data.awaitingTarget }"
    :role="data.awaitingTarget ? 'button' : undefined" :tabindex="data.awaitingTarget ? 0 : undefined"
    @click="data.awaitingTarget && emit('selectTarget')"
    @keydown.enter.self.stop.prevent="data.awaitingTarget && emit('selectTarget')"
    @keydown.space.self.stop.prevent="data.awaitingTarget && emit('selectTarget')"
  >
    <Handle
      type="target" class="workflow-node-target" :position="Position.Left" :connectable="!data.readOnly"
      :class="{ 'click-target-ready': data.awaitingTarget }" role="button" :tabindex="data.readOnly ? -1 : 0"
      aria-label="选择工作流节点作为连线终点" @click.stop="emit('selectTarget')"
      @keydown.enter.stop.prevent="emit('selectTarget')" @keydown.space.stop.prevent="emit('selectTarget')"
    />
    <header>
      <span class="workflow-node-order">{{ data.order }}</span>
      <div class="workflow-call-title"><small><AppIcon name="workflow" :size="12" /> 工作流</small><strong :title="data.label">{{ data.label }}</strong></div>
      <span v-if="data.runStatus" class="workflow-run-status" :data-status="data.runStatus">{{ workflowRunStatusLabels[data.runStatus] }}</span>
      <span v-else-if="!data.complete" class="workflow-control-warning">待配置</span>
    </header>
    <p :title="data.workflowName">{{ data.workflowName }}</p>
    <small v-if="data.totalSteps">内部 {{ data.completedSteps }} / {{ data.totalSteps }} 个节点成功或已处理</small>
    <small v-else>{{ data.readOnly ? '点击查看内部执行记录' : '等待子工作流完成后继续' }}</small>
    <Handle
      type="source" :position="Position.Right" :connectable="!data.readOnly"
      :class="{ 'click-source-active': data.connectionSource }" role="button" :tabindex="data.readOnly ? -1 : 0"
      aria-label="选择工作流完成出口" @click.stop="emit('selectSource')"
      @keydown.enter.stop.prevent="emit('selectSource')" @keydown.space.stop.prevent="emit('selectSource')"
    />
  </div>
</template>

<style scoped>
.workflow-call-node { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; width: 268px; padding: 14px 16px; }
.workflow-call-node .workflow-node-order { flex-shrink: 0; }
.workflow-call-node header { display: flex; align-items: center; gap: 10px; min-width: 0; }
.workflow-call-title { flex: 1; min-width: 0; }
.workflow-call-title strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workflow-call-title small { display: flex; align-items: center; gap: 4px; }
.workflow-call-node p { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workflow-call-node small { color: var(--muted); font-size: 11px; }
.workflow-call-node .workflow-run-status { font-size: 11px; white-space: nowrap; }
</style>

<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { workflowRunStatusLabels } from '#shared/config/workflow-run-status'
import type { WorkflowStepStatus } from '#shared/types/workflow-runs'

const props = defineProps<{
  id: string
  data: {
    label: string
    assetLabel: string
    description: string
    complete: boolean
    order: number
    connectionSource: boolean
    connectionSourceHandle: string | null
    exceptionPorts: { id: string, code: string, description: string }[]
    canAddException: boolean
    awaitingTarget: boolean
    runStatus?: WorkflowStepStatus
    readOnly?: boolean
  }
}>()

const emit = defineEmits<{
  selectSource: [handleId?: string]
  selectTarget: []
  addException: []
}>()
const { updateNodeInternals } = useVueFlow()
watch(() => props.data.exceptionPorts.map(port => port.id + ':' + port.code).join(','), async () => {
  await nextTick()
  updateNodeInternals([props.id])
})
</script>

<template>
  <div
    class="workflow-flow-node operation-node"
    :class="{ incomplete: !data.complete, 'connection-target-ready': data.awaitingTarget }"
    :data-run-status="data.runStatus"
    :role="data.awaitingTarget ? 'button' : undefined"
    :tabindex="data.awaitingTarget ? 0 : undefined"
    @click="data.awaitingTarget && emit('selectTarget')"
    @keydown.enter.self.stop.prevent="data.awaitingTarget && emit('selectTarget')"
    @keydown.space.self.stop.prevent="data.awaitingTarget && emit('selectTarget')"
  >
    <Handle
      type="target"
      :position="Position.Top"
      :connectable="!data.readOnly"
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
      :connectable="!data.readOnly"
      :class="{ 'click-source-active': data.connectionSource && !data.connectionSourceHandle }"
      role="button"
      :tabindex="data.readOnly ? -1 : 0"
      aria-label="选择正常执行出口"
      @click.stop="emit('selectSource')"
      @keydown.enter.stop.prevent="emit('selectSource')"
      @keydown.space.stop.prevent="emit('selectSource')"
    />
    <div v-if="data.exceptionPorts.length" class="workflow-exception-ports">
      <div v-for="port in data.exceptionPorts" :key="port.id" class="workflow-exception-port">
        <button
          type="button" class="nodrag" :disabled="data.readOnly"
          :class="{ active: data.connectionSourceHandle === port.id }"
          :aria-label="'选择异常端点：' + port.code" :title="port.code + ' · ' + port.description"
          @click.stop="emit('selectSource', port.id)"
        ><span>{{ port.description }}</span><small>{{ port.code }}</small></button>
        <Handle
          :id="port.id" type="source" :position="Position.Right" :connectable="!data.readOnly"
          :class="{ 'click-source-active': data.connectionSourceHandle === port.id }"
          role="button" :tabindex="data.readOnly ? -1 : 0" :aria-label="port.code + '异常输出圆点'"
          @click.stop="emit('selectSource', port.id)"
          @keydown.enter.stop.prevent="emit('selectSource', port.id)"
          @keydown.space.stop.prevent="emit('selectSource', port.id)"
        />
      </div>
    </div>
    <button
      v-if="!data.readOnly" type="button" class="workflow-exception-add nodrag"
      :disabled="!data.canAddException" @click.stop="emit('addException')"
    >＋ 添加异常端点</button>
    <span v-if="data.exceptionPorts.length" class="workflow-operation-normal-label">正常执行 ↓</span>
  </div>
</template>

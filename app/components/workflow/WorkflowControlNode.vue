<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { WorkflowBranch, WorkflowControlKind } from '#shared/types/asdp'
import type { WorkflowStepStatus } from '#shared/types/workflow-runs'
import { workflowRunStatusLabels } from '#shared/config/workflow-run-status'
import { workflowControlBranch } from '#shared/utils/workflow-nodes'

const props = defineProps<{
  id: string
  data: {
    kind: WorkflowControlKind
    label: string
    branches: WorkflowBranch[]
    complete: boolean
    order: number
    connectionSourceHandle: string | null
    awaitingTarget: boolean
    runStatus?: WorkflowStepStatus
    readOnly?: boolean
  }
}>()
const emit = defineEmits<{
  selectSource: [handleId: string]
  selectTarget: []
}>()
const legacy = computed(() => props.data.readOnly && (props.data.branches.length !== 1 || props.data.branches[0]?.id !== workflowControlBranch.id))
const ports = computed(() => [
  ...(legacy.value ? props.data.branches : [workflowControlBranch]).map(branch => ({ ...branch, kind: 'branch' })),
  { id: 'complete', label: '完成', kind: 'complete' },
  { id: 'error', label: '异常', kind: 'error' },
])
</script>

<template>
  <div
    class="workflow-flow-node workflow-control-node"
    :data-control-kind="data.kind"
    :class="{ incomplete: !data.complete, 'connection-target-ready': data.awaitingTarget }"
    :data-run-status="data.runStatus"
    :role="data.awaitingTarget ? 'button' : undefined"
    :tabindex="data.awaitingTarget ? 0 : undefined"
    @click="data.awaitingTarget && emit('selectTarget')"
    @keydown.enter.self.stop.prevent="data.awaitingTarget && emit('selectTarget')"
    @keydown.space.self.stop.prevent="data.awaitingTarget && emit('selectTarget')"
  >
    <Handle
      type="target" class="workflow-node-target" :position="Position.Left" :connectable="!data.readOnly"
      :class="{ 'click-target-ready': data.awaitingTarget }"
      role="button" :tabindex="data.readOnly ? -1 : 0" :aria-label="data.kind === 'sync' ? '选择同步节点作为连线终点' : '选择异步节点作为连线终点'"
      @click.stop="emit('selectTarget')"
      @keydown.enter.stop.prevent="emit('selectTarget')"
      @keydown.space.stop.prevent="emit('selectTarget')"
    />
    <header class="workflow-control-heading">
      <span class="workflow-node-order">{{ data.order }}</span>
      <div><small>{{ data.kind === 'sync' ? '顺序控制' : '并发控制' }}</small><strong :title="data.label">{{ data.label }}</strong></div>
      <span v-if="data.runStatus" class="workflow-run-status" :data-status="data.runStatus">{{ workflowRunStatusLabels[data.runStatus] }}</span>
      <span v-else-if="!data.complete" class="workflow-control-warning">待配置</span>
    </header>
    <p class="workflow-control-description">{{ legacy ? '历史配置 · 按子端点执行' : data.kind === 'sync' ? '按数组顺序逐项执行唯一子流程' : '按数组元素并发执行唯一子流程' }}</p>
    <div class="workflow-control-ports">
      <div v-for="port in ports" :key="port.id" class="workflow-control-port" :data-port-kind="port.kind">
        <button
          type="button" class="nodrag" :disabled="data.readOnly"
          :class="{ active: data.connectionSourceHandle === port.id }"
          :aria-label="'选择输出端点：' + port.label" :title="port.label"
          @click.stop="emit('selectSource', port.id)"
        ><span>{{ port.label }}</span><small>{{ port.kind === 'branch' ? (legacy ? '历史子流程' : '当前元素 → 子节点') : port.kind === 'complete' ? '全部成功' : '存在失败' }}</small></button>
        <Handle
          :id="port.id" type="source" :position="Position.Right" :connectable="!data.readOnly"
          :class="{ 'click-source-active': data.connectionSourceHandle === port.id }"
          role="button" :tabindex="data.readOnly ? -1 : 0" :aria-label="port.label + '输出圆点'"
          @click.stop="emit('selectSource', port.id)"
          @keydown.enter.stop.prevent="emit('selectSource', port.id)"
          @keydown.space.stop.prevent="emit('selectSource', port.id)"
        />
      </div>
    </div>
  </div>
</template>

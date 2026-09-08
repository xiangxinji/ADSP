<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { WorkflowAsyncBranch } from '#shared/types/asdp'
import type { WorkflowStepStatus } from '#shared/types/workflow-runs'
import { workflowRunStatusLabels } from '#shared/config/workflow-run-status'
import { workflowBranchLimit } from '#shared/utils/workflow-nodes'

const props = defineProps<{
  id: string
  data: {
    label: string
    branches: WorkflowAsyncBranch[]
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
  addBranch: []
}>()
const { updateNodeInternals } = useVueFlow()
const ports = computed(() => [
  ...props.data.branches.map(branch => ({ ...branch, kind: 'branch' })),
  { id: 'complete', label: '完成', kind: 'complete' },
  { id: 'error', label: '异常', kind: 'error' },
])
watch(() => props.data.branches.map(branch => branch.id).join(','), async () => {
  await nextTick()
  updateNodeInternals([props.id])
})
</script>

<template>
  <div
    class="workflow-flow-node workflow-async-node"
    :class="{ incomplete: !data.complete, 'connection-target-ready': data.awaitingTarget }"
    :data-run-status="data.runStatus"
    :role="data.awaitingTarget ? 'button' : undefined"
    :tabindex="data.awaitingTarget ? 0 : undefined"
    @click="data.awaitingTarget && emit('selectTarget')"
    @keydown.enter.self.stop.prevent="data.awaitingTarget && emit('selectTarget')"
    @keydown.space.self.stop.prevent="data.awaitingTarget && emit('selectTarget')"
  >
    <Handle
      type="target" :position="Position.Top" :connectable="!data.readOnly"
      :class="{ 'click-target-ready': data.awaitingTarget }"
      role="button" :tabindex="data.readOnly ? -1 : 0" aria-label="选择异步节点作为连线终点"
      @click.stop="emit('selectTarget')"
      @keydown.enter.stop.prevent="emit('selectTarget')"
      @keydown.space.stop.prevent="emit('selectTarget')"
    />
    <header class="workflow-async-heading">
      <span class="workflow-node-order">{{ data.order }}</span>
      <div><small>并发控制</small><strong :title="data.label">{{ data.label }}</strong></div>
      <span v-if="data.runStatus" class="workflow-run-status" :data-status="data.runStatus">{{ workflowRunStatusLabels[data.runStatus] }}</span>
      <span v-else-if="!data.complete" class="workflow-async-warning">待配置</span>
    </header>
    <p class="workflow-async-description">并发执行子流程，全部结束后分流</p>
    <div class="workflow-async-ports">
      <div v-for="port in ports" :key="port.id" class="workflow-async-port" :data-port-kind="port.kind">
        <button
          type="button" class="nodrag" :disabled="data.readOnly"
          :class="{ active: data.connectionSourceHandle === port.id }"
          :aria-label="'选择输出端点：' + port.label" :title="port.label"
          @click.stop="emit('selectSource', port.id)"
        ><span>{{ port.label }}</span><small>{{ port.kind === 'branch' ? '子流程' : port.kind === 'complete' ? '全部成功' : '存在失败' }}</small></button>
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
    <button v-if="!data.readOnly" type="button" class="workflow-async-add nodrag" :disabled="data.branches.length >= workflowBranchLimit" @click.stop="emit('addBranch')">＋ 添加子端点</button>
  </div>
</template>

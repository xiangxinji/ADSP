<script setup lang="ts">
import { workflowRunStatusLabels } from '#shared/config/workflow-run-status'
import type { WorkflowRun } from '#shared/types/workflow-runs'
import { formatWorkflowRunTime, workflowRunNodeLabel } from '~/utils/workflow-run-display'

const props = defineProps<{
  runs: WorkflowRun[]
  run: WorkflowRun | null
  selectedNodeId: string | null
  loading: boolean
  error: string
}>()
const emit = defineEmits<{
  selectRun: [id: string]
  selectNode: [id: string]
  retry: []
}>()

const activeSteps = computed(() => props.run?.steps.filter(step => step.status === 'running') || [])
const summaryStep = computed(() => props.run?.steps.find(step => step.nodeId === props.selectedNodeId)
  || activeSteps.value[0] || props.run?.steps.find(step => step.status === 'failed') || props.run?.steps.at(-1))
const completedCount = computed(() => props.run?.steps.filter(step => step.status === 'succeeded' || step.status === 'handled').length || 0)
const nodeLabel = (nodeId: string) => workflowRunNodeLabel(props.run, nodeId)
</script>

<template>
  <aside class="workflow-sidebar workflow-inspector workflow-run-panel" aria-label="工作流执行记录">
    <header class="workflow-sidebar-heading">
      <p class="overline">WORKFLOW RUNS</p><h2>执行记录</h2>
      <span>每秒更新状态，点击节点查看输入、输出和错误。</span>
    </header>
    <p v-if="error" class="alert error-state" role="alert">{{ error }} <AppButton size="sm" variant="text" @click="emit('retry')">重试</AppButton></p>
    <p v-if="loading" role="status">正在加载执行记录…</p>
    <template v-if="run">
      <label class="workflow-run-history-label" for="workflow-run-history">运行历史</label>
      <select id="workflow-run-history" class="workflow-run-history" :value="run.id" @change="emit('selectRun', ($event.target as HTMLSelectElement).value)">
        <option v-for="item in runs" :key="item.id" :value="item.id">{{ formatWorkflowRunTime(item.startedAt) }} · {{ workflowRunStatusLabels[item.status] }} · {{ item.id.slice(0, 8) }}</option>
      </select>
      <section class="workflow-run-summary" role="status" aria-live="polite">
        <strong class="workflow-run-status" :data-status="run.status">{{ workflowRunStatusLabels[run.status] }}</strong>
        <span>{{ completedCount }} / {{ run.steps.length }} 个节点成功或异常已处理</span>
        <p v-if="activeSteps.length">执行中（{{ activeSteps.length }}）：{{ activeSteps.map(step => nodeLabel(step.nodeId)).join('、') }}</p>
        <p v-else-if="run.status === 'failed'">执行结束，存在未处理的失败；未命中的出口及失败后的节点已跳过。</p>
        <p v-else-if="run.status === 'running'">等待节点执行状态更新。</p>
        <p v-else>执行完成，未命中的出口已跳过。</p>
      </section>
      <details class="workflow-run-root"><summary>根触发器输出</summary><pre>{{ JSON.stringify(run.root, null, 2) }}</pre></details>
      <ol class="workflow-run-steps" aria-label="节点执行进度">
        <li v-for="(step, index) in run.steps" :key="step.nodeId">
          <button type="button" :aria-pressed="summaryStep?.nodeId === step.nodeId" :aria-current="step.status === 'running' ? 'step' : undefined" @click="emit('selectNode', step.nodeId)">
            <span class="workflow-run-step-number">{{ index + 1 }}</span>
            <span><strong>{{ nodeLabel(step.nodeId) }}</strong><small class="workflow-run-status" :data-status="step.status">{{ workflowRunStatusLabels[step.status] }}</small></span>
          </button>
        </li>
      </ol>
      <WorkflowRunStepDetail
        v-if="summaryStep"
        :run="run"
        :step="summaryStep"
        @select-node="emit('selectNode', $event)"
      />
      <p class="workflow-run-id">运行 ID：{{ run.id }}</p>
    </template>
    <p v-else-if="!loading" class="workflow-library-empty">暂无执行记录。配置手动触发器并连接操作节点后，点击「运行工作流」。</p>
  </aside>
</template>

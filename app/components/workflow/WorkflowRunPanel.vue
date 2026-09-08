<script setup lang="ts">
import { workflowNodeLabel } from '#shared/utils/workflow-nodes'
import { workflowRunStatusLabels } from '#shared/config/workflow-run-status'
import type { WorkflowRun } from '#shared/types/workflow-runs'

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
const activeStep = computed(() => activeSteps.value[0])
const selectedStep = computed(() => props.run?.steps.find(step => step.nodeId === props.selectedNodeId)
  || activeStep.value || props.run?.steps.find(step => step.status === 'failed') || props.run?.steps.at(-1))
const selectedNode = computed(() => props.run?.workflow.nodes.find(node => node.id === selectedStep.value?.nodeId))
const completedCount = computed(() => props.run?.steps.filter(step => step.status === 'succeeded').length || 0)
const selectedInputs = computed(() => selectedNode.value?.kind === 'async' ? { branches: selectedNode.value.branches } : selectedNode.value?.inputs)
const asyncOutput = computed(() => {
  const output = selectedStep.value?.output
  return output && 'branches' in output && 'selectedPort' in output ? output : null
})
const branchLabel = (portId: string) => selectedNode.value?.kind === 'async'
  ? selectedNode.value.branches.find(branch => branch.id === portId)?.label || portId : portId
const nodeLabel = (nodeId: string) => {
  const node = props.run?.workflow.nodes.find(item => item.id === nodeId)
  return node ? workflowNodeLabel(node) : nodeId
}
const formatTime = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
const duration = computed(() => {
  const step = selectedStep.value
  if (!step?.startedAt || !step.finishedAt) return step?.status === 'running' ? '执行中' : '—'
  return `${((Date.parse(step.finishedAt) - Date.parse(step.startedAt)) / 1000).toFixed(2)} 秒`
})
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
        <option v-for="item in runs" :key="item.id" :value="item.id">{{ formatTime(item.startedAt) }} · {{ workflowRunStatusLabels[item.status] }} · {{ item.id.slice(0, 8) }}</option>
      </select>
      <section class="workflow-run-summary" role="status" aria-live="polite">
        <strong class="workflow-run-status" :data-status="run.status">{{ workflowRunStatusLabels[run.status] }}</strong>
        <span>{{ completedCount }} / {{ run.steps.length }} 个节点成功</span>
        <p v-if="activeSteps.length">执行中（{{ activeSteps.length }}）：{{ activeSteps.map(step => nodeLabel(step.nodeId)).join('、') }}</p>
        <p v-else-if="run.status === 'failed'">执行结束，原始失败已保留；未命中的出口及失败后的节点已跳过。</p>
        <p v-else-if="run.status === 'running'">等待节点执行状态更新。</p>
        <p v-else>执行完成，未命中的出口已跳过。</p>
      </section>
      <ol class="workflow-run-steps" aria-label="节点执行进度">
        <li v-for="(step, index) in run.steps" :key="step.nodeId">
          <button type="button" :aria-pressed="selectedStep?.nodeId === step.nodeId" :aria-current="step.status === 'running' ? 'step' : undefined" @click="emit('selectNode', step.nodeId)">
            <span class="workflow-run-step-number">{{ index + 1 }}</span>
            <span><strong>{{ nodeLabel(step.nodeId) }}</strong><small class="workflow-run-status" :data-status="step.status">{{ workflowRunStatusLabels[step.status] }}</small></span>
          </button>
        </li>
      </ol>
      <section v-if="selectedStep && selectedNode" class="workflow-run-detail" aria-label="节点执行结果">
        <h3>{{ nodeLabel(selectedStep.nodeId) }}</h3>
        <dl><dt>开始时间</dt><dd>{{ formatTime(selectedStep.startedAt) }}</dd><dt>结束时间</dt><dd>{{ formatTime(selectedStep.finishedAt) }}</dd><dt>耗时</dt><dd>{{ duration }}</dd></dl>
        <details><summary>{{ selectedNode.kind === 'async' ? '子端点配置' : '输入参数' }}</summary><pre>{{ JSON.stringify(selectedInputs, null, 2) }}</pre></details>
        <section v-if="asyncOutput" class="workflow-async-results" aria-label="异步子流程结果">
          <h4>执行出口：{{ asyncOutput.selectedPort === 'complete' ? '完成' : '异常' }}</h4>
          <button v-for="branch in asyncOutput.branches" :key="branch.portId" type="button" @click="emit('selectNode', branch.failedNodeId || branch.nodeId)">
            <strong>{{ branchLabel(branch.portId) }}</strong>
            <span class="workflow-run-status" :data-status="branch.status">{{ workflowRunStatusLabels[branch.status] }}</span>
            <small v-if="branch.error">{{ branch.error.code }} · {{ branch.error.message }}</small>
          </button>
        </section>
        <div v-if="selectedStep.error" class="alert error-state" role="alert"><strong>{{ selectedStep.error.code }}</strong><p>{{ selectedStep.error.message }}</p></div>
        <template v-if="selectedStep.output !== null"><h4>输出结果</h4><pre>{{ JSON.stringify(selectedStep.output, null, 2) }}</pre></template>
        <p v-else-if="selectedStep.status === 'pending'">等待上游节点完成。</p>
        <p v-else-if="selectedStep.status === 'running'">当前节点正在执行，结果会自动更新。</p>
        <p v-else-if="selectedStep.status === 'skipped'">本节点未执行。</p>
      </section>
      <p class="workflow-run-id">运行 ID：{{ run.id }}</p>
    </template>
    <p v-else-if="!loading" class="workflow-library-empty">暂无执行记录。配置手动触发器并连接操作节点后，点击「运行工作流」。</p>
  </aside>
</template>

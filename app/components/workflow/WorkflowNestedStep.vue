<script setup lang="ts">
import type { WorkflowRunStep } from '#shared/types/workflow-runs'
import { workflowRunStatusLabels } from '#shared/config/workflow-run-status'

defineProps<{ step: WorkflowRunStep, label: string }>()
const formatTime = (value: string | null) => value ? new Date(value).toLocaleTimeString('zh-CN', { hour12: false }) : '—'
</script>

<template>
  <details class="workflow-nested-step" :open="step.status === 'running' || step.status === 'failed'">
    <summary><strong>{{ label }}</strong><span class="workflow-run-status" :data-status="step.status">{{ workflowRunStatusLabels[step.status] }}</span></summary>
    <p>开始 {{ formatTime(step.startedAt) }} · 结束 {{ formatTime(step.finishedAt) }}</p>
    <p v-if="step.error" class="workflow-nested-error" :role="step.status === 'handled' ? 'status' : 'alert'">{{ step.error.code }} · {{ step.error.message }}</p>
    <details v-if="step.resolvedInputs"><summary>实际输入</summary><pre>{{ JSON.stringify(step.resolvedInputs, null, 2) }}</pre></details>
    <template v-if="step.executions?.length">
      <WorkflowNestedStep
        v-for="execution in step.executions" :key="JSON.stringify(execution.iterationPath)" :step="execution"
        :label="execution.iterationPath.map(item => '第 ' + (item.index + 1) + ' 项').join(' / ')"
      />
    </template>
    <WorkflowNestedRun v-else-if="step.childRun" :key="step.childRun.id" :run="step.childRun" />
    <details v-if="step.output !== null"><summary>输出结果</summary><pre>{{ JSON.stringify(step.output, null, 2) }}</pre></details>
    <p v-else-if="step.status === 'pending'">等待上游节点完成。</p>
    <p v-else-if="step.status === 'skipped'">本节点未执行。</p>
  </details>
</template>

<style scoped>
.workflow-nested-step { min-width: 0; margin-top: 6px; padding: 8px; border: 1px solid var(--line); border-radius: 6px; }
summary { cursor: pointer; font-size: 12px; overflow-wrap: anywhere; }
summary strong { margin-right: 8px; }
summary .workflow-run-status { white-space: nowrap; }
p { font-size: 11px; overflow-wrap: anywhere; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
.workflow-nested-error { color: var(--danger); }
</style>

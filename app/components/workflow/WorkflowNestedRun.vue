<script setup lang="ts">
import type { WorkflowRun } from '#shared/types/workflow-runs'
import { workflowRunStatusLabels } from '#shared/config/workflow-run-status'
import { workflowNodeLabel } from '#shared/utils/workflow-nodes'

const props = defineProps<{ run: WorkflowRun }>()
const completed = computed(() => props.run.steps.filter(step => step.status === 'succeeded' || step.status === 'handled').length)
const label = (nodeId: string) => {
  const node = props.run.workflow.nodes.find(node => node.id === nodeId)
  return node ? workflowNodeLabel(node) : nodeId
}
</script>

<template>
  <section class="workflow-nested-run" aria-label="子工作流内部执行状态">
    <header><strong>{{ run.workflow.name }}</strong><span class="workflow-run-status" :data-status="run.status">{{ workflowRunStatusLabels[run.status] }}</span></header>
    <p>{{ completed }} / {{ run.steps.length }} 个内部节点成功或已处理</p>
    <details><summary>子工作流根数据</summary><pre>{{ JSON.stringify(run.root, null, 2) }}</pre></details>
    <ol aria-label="内部节点执行进度">
      <li v-for="step in run.steps" :key="step.nodeId"><WorkflowNestedStep :step="step" :label="label(step.nodeId)" /></li>
    </ol>
    <p class="workflow-nested-id">子运行 ID：{{ run.id }}</p>
  </section>
</template>

<style scoped>
.workflow-nested-run { min-width: 0; margin-top: 12px; padding: 12px; border: 1px solid var(--line); border-radius: 8px; }
header { display: flex; align-items: start; justify-content: space-between; gap: 8px; }
header strong { min-width: 0; overflow-wrap: anywhere; }
header span { flex-shrink: 0; }
p, summary { font-size: 12px; }
ol { display: grid; gap: 8px; margin: 12px 0; padding: 0; list-style: none; }
li { min-width: 0; }
.workflow-nested-id { color: var(--muted); overflow-wrap: anywhere; font-size: 10px; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>

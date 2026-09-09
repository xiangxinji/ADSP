<script setup lang="ts">
import type { WorkflowDefinition, WorkflowSubworkflowNode } from '#shared/types/asdp'
import { analyzeWorkflowReferences, workflowNestingLimit } from '#shared/utils/workflow-references'

const props = defineProps<{
  node: WorkflowSubworkflowNode
  workflow: WorkflowDefinition
  workflows: WorkflowDefinition[]
}>()
const emit = defineEmits<{
  updateWorkflow: [workflowId: string]
  updateLabel: [label: string]
}>()
const options = computed(() => props.workflows
  .filter(workflow => workflow.projectId === props.workflow.projectId && workflow.id !== props.workflow.id)
  .map(workflow => {
    const candidate = { ...props.workflow, nodes: props.workflow.nodes.map(node => node.id === props.node.id ? { ...props.node, workflowId: workflow.id } : node) }
    return { workflow, error: analyzeWorkflowReferences(candidate, id => props.workflows.find(item => item.id === id)).error?.message }
  }))
const target = computed(() => options.value.find(option => option.workflow.id === props.node.workflowId)?.workflow)
</script>

<template>
  <div class="workflow-subworkflow-inspector">
    <AppFormField field-id="workflow-call-label" label="节点名称">
      <AppInput id="workflow-call-label" :model-value="node.label" maxlength="100" @update:model-value="emit('updateLabel', String($event || ''))" />
    </AppFormField>
    <AppFormField field-id="workflow-call-target" label="执行工作流">
      <select id="workflow-call-target" class="workflow-run-history" :value="node.workflowId" @change="emit('updateWorkflow', ($event.target as HTMLSelectElement).value)">
        <option value="" disabled>请选择当前项目的工作流</option>
        <option v-if="node.workflowId && !target" :value="node.workflowId" disabled>引用的工作流已不存在</option>
        <option v-for="option in options" :key="option.workflow.id" :value="option.workflow.id" :disabled="Boolean(option.error)">
          {{ option.workflow.name }}{{ option.error ? ' · 不可调用' : '' }}
        </option>
      </select>
    </AppFormField>
    <p v-if="!options.length" class="workflow-operation-help">当前项目暂无其他工作流，请先在工作流列表中创建一个。</p>
    <p v-if="target && (!target.trigger || !target.nodes.length)" class="alert error-state">子工作流尚未配置完整，需要保存触发器和节点后才能执行。</p>
    <div class="workflow-output-contract">
      <strong>调用规则</strong>
      <p class="workflow-operation-help">将上游输出原样传给子工作流的根触发器，内部使用 $root.xxx 或首节点的 $prev.xxx 读取；直接连接根触发器时传入本次根数据。</p>
      <p class="workflow-operation-help">等待内部全部执行完成，子工作流最终执行路径的输出作为本节点输出，下游继续通过 $prev.xxx 读取。支持对象和数组。</p>
      <p class="workflow-operation-help">内部失败会使本节点失败，并保留原始错误。执行记录可展开查看内部节点和逐项调用状态。</p>
      <p class="workflow-operation-help">仅限同一项目，禁止循环调用，最多 {{ workflowNestingLimit }} 层（含当前工作流）。调用使用启动时的已保存快照。</p>
    </div>
  </div>
</template>

<style scoped>
.workflow-subworkflow-inspector { display: grid; gap: var(--space-3); }
</style>

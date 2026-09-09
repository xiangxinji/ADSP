<script setup lang="ts">
import type { WorkflowDefinition, WorkflowEdge } from '#shared/types/asdp'
import { validateWorkflowEdges, workflowTriggerNodeId } from '#shared/utils/workflow-graph'
import { workflowNodeLabel, workflowOutputPorts } from '#shared/utils/workflow-nodes'

type Source = Pick<WorkflowEdge, 'source' | 'sourceHandle'>
const props = defineProps<{ workflow: WorkflowDefinition, nodeId: string }>()
const emit = defineEmits<{ change: [source: Source | null] }>()
const sourceKey = (source: Source) => JSON.stringify([source.source, source.sourceHandle || null])
const current = computed(() => props.workflow.edges.find(edge => edge.target === props.nodeId))
const options = computed(() => {
  const sources = [
    { source: workflowTriggerNodeId, label: '根触发器', sourceHandle: undefined as string | undefined },
    ...props.workflow.nodes.filter(node => node.id !== props.nodeId).flatMap(node => workflowOutputPorts(node).map(port => ({
      source: node.id, sourceHandle: port.id,
      label: workflowNodeLabel(node) + (port.id ? ' · ' + port.label : ''),
    }))),
  ]
  return sources.map(source => ({
    ...source, key: sourceKey(source),
    disabled: Boolean(validateWorkflowEdges(props.workflow.nodes, [
      ...props.workflow.edges.filter(edge => edge.target !== props.nodeId),
      { id: globalThis.crypto.randomUUID(), source: source.source, sourceHandle: source.sourceHandle, target: props.nodeId },
    ])),
  }))
})
const changeSource = (key: string) => {
  const option = options.value.find(option => option.key === key)
  if (option?.disabled) return
  emit('change', option ? { source: option.source, ...(option.sourceHandle ? { sourceHandle: option.sourceHandle } : {}) } : null)
}
</script>

<template>
  <AppFormField field-id="workflow-upstream" label="上游节点 / 端点" hint="选择上游节点的正常或异常出口；同步和异步节点还可选择执行子端点。">
    <AppSelect id="workflow-upstream" :model-value="current ? sourceKey(current) : ''" @update:model-value="changeSource(String($event || ''))">
      <option value="">未连接</option>
      <option v-for="option in options" :key="option.key" :value="option.key" :disabled="option.disabled">{{ option.label }}</option>
    </AppSelect>
  </AppFormField>
</template>

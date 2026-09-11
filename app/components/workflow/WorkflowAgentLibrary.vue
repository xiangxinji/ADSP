<script setup lang="ts">
import { assetOperationsForModule } from '#shared/config/asset-operations'
import { agentExecutorForOperation } from '#shared/types/agent-executors'
import type { WorkflowOperationSelection } from '~/utils/workflow-node-drag'

const props = defineProps<{ enabled: boolean }>()
const emit = defineEmits<{
  addOperation: [selection: WorkflowOperationSelection]
  inspect: [node: { label: string, description: string } | null]
}>()
const operations = assetOperationsForModule('repositories').filter(operation => agentExecutorForOperation(operation.id))
const { draggingId, startDrag, finishDrag } = useWorkflowLibraryDrag(() => props.enabled)
const selectionFor = (operationId: string): WorkflowOperationSelection => ({ assetType: 'repository', operationId })
</script>

<template>
  <section class="node-flow-library" aria-label="智能体执行器">
    <div class="node-library-section-heading"><h3>智能体执行器</h3><span>{{ operations.length }}</span></div>
    <div class="agent-library-grid">
      <button
        v-for="operation in operations" :key="operation.id" class="node-flow-tile" type="button"
        :class="{ dragging: draggingId === operation.id }" :disabled="!enabled" :draggable="enabled"
        :aria-label="'添加' + operation.label" :title="operation.description" aria-describedby="workflow-node-drag-help"
        @click="emit('addOperation', selectionFor(operation.id))"
        @dragstart="startDrag($event, { type: 'operation', selection: selectionFor(operation.id) }, operation.id)"
        @dragend="finishDrag" @mouseenter="emit('inspect', operation)" @mouseleave="emit('inspect', null)"
        @focus="emit('inspect', operation)" @blur="emit('inspect', null)"
      >
        <span class="node-library-symbol" data-tone="purple"><AppIcon name="search" :size="18" /></span>
        <strong>{{ agentExecutorForOperation(operation.id) === 'codex' ? 'Codex' : 'Claude Code' }}</strong>
      </button>
    </div>
  </section>
</template>

<style scoped>
.agent-library-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
</style>

<script setup lang="ts">
import type { WorkflowControlKind, WorkflowTriggerKind } from '#shared/types/asdp'
import type { WorkflowOperationSelection } from '~/utils/workflow-node-drag'

defineProps<{ triggerKind: WorkflowTriggerKind | null }>()
const emit = defineEmits<{
  selectTrigger: [kind: WorkflowTriggerKind]
  addControlNode: [kind: WorkflowControlKind]
  addOperation: [selection: WorkflowOperationSelection]
  addSubworkflow: []
}>()
const preview = ref<{ label: string, description: string } | null>(null)
</script>

<template>
  <aside class="workflow-sidebar workflow-library workflow-node-library" aria-label="工作流节点库">
    <header class="node-library-heading">
      <span class="node-library-heading-icon"><AppIcon name="versions" :size="18" /></span>
      <h2>节点库</h2>
      <span class="node-library-heading-hint">拖放到画布</span>
    </header>
    <WorkflowTriggerPicker :trigger-kind="triggerKind" @select="emit('selectTrigger', $event)" />
    <WorkflowFlowNodeLibrary
      :enabled="Boolean(triggerKind)" @inspect="preview = $event"
      @add-control-node="emit('addControlNode', $event)" @add-subworkflow="emit('addSubworkflow')"
    />
    <WorkflowOperationLibrary
      :enabled="Boolean(triggerKind)" @inspect="preview = $event" @add-operation="emit('addOperation', $event)"
    />
    <footer class="node-library-footer" :class="{ 'needs-trigger': !triggerKind }">
      <p id="workflow-node-drag-help">
        <AppIcon :name="triggerKind ? 'add' : 'alert'" :size="14" />
        {{ triggerKind ? '点击添加 · 拖入画布定位' : '先选择根触发器，再添加节点' }}
      </p>
      <div v-if="preview" class="node-library-preview">
        <strong>{{ preview.label }}</strong>
        <p :title="preview.description">{{ preview.description }}</p>
      </div>
    </footer>
  </aside>
</template>

<style src="~/assets/css/workflow-library.css"></style>

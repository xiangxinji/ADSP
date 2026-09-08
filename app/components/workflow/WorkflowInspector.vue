<script setup lang="ts">
import { findAssetOperation } from '#shared/config/asset-operations'
import type { ProjectWorkspace, WorkflowDefinition, WorkflowEdge, WorkflowOperationInputValue, WorkflowNode } from '#shared/types/asdp'

const props = defineProps<{
  workflow: WorkflowDefinition
  workspace: ProjectWorkspace
  selectedNode: WorkflowNode | null
}>()
const emit = defineEmits<{
  updateName: [value: string]
  updateNote: [value: string]
  updateInput: [name: string, value: WorkflowOperationInputValue]
  setUpstream: [source: Pick<WorkflowEdge, 'source' | 'sourceHandle'> | null]
  removeNode: []
  addAsyncBranch: [nodeId: string]
  updateAsyncLabel: [nodeId: string, label: string]
  renameAsyncBranch: [nodeId: string, branchId: string, label: string]
  removeAsyncBranch: [nodeId: string, branchId: string]
  addExceptionPort: [nodeId: string]
  updateExceptionPort: [nodeId: string, portId: string, code: string]
  removeExceptionPort: [nodeId: string, portId: string]
}>()
const operationNode = computed(() => props.selectedNode?.kind !== 'async' ? props.selectedNode : null)
const operation = computed(() => operationNode.value
  ? findAssetOperation(operationNode.value.assetType, operationNode.value.operationId) : undefined)
const inputFields = computed(() => operation.value?.workflow.enabled
  ? operation.value.contract.input.filter(field => field.name !== operationNode.value?.assetType + 'Id') : [])
const assetLabel = computed(() => {
  if (!operationNode.value) return ''
  const { assetType, assetId } = operationNode.value
  if (assetType === 'repository') return props.workspace.repositories.find(asset => asset.id === assetId)?.name
  if (assetType === 'member') return props.workspace.members.find(asset => asset.id === assetId)?.user.name
  if (assetType === 'environment') return props.workspace.environments.find(asset => asset.id === assetId)?.address
  return props.workspace.knowledge.find(asset => asset.id === assetId)?.title
})
</script>

<template>
  <aside class="workflow-sidebar workflow-inspector" aria-label="工作流配置">
    <div class="workflow-sidebar-heading"><p class="overline">CONFIGURATION</p><h2>配置</h2><span>修改基本信息和当前选中的节点。</span></div>
    <section class="workflow-inspector-section">
      <div class="workflow-library-title"><strong>基本信息</strong><span>名称必填</span></div>
      <AppFormField field-id="workflow-editor-name" label="名称">
        <AppInput id="workflow-editor-name" :model-value="workflow.name" maxlength="100" @update:model-value="emit('updateName', String($event || ''))" />
      </AppFormField>
      <AppFormField field-id="workflow-editor-note" label="备注">
        <AppTextarea id="workflow-editor-note" :model-value="workflow.note" maxlength="500" rows="3" @update:model-value="emit('updateNote', String($event || ''))" />
      </AppFormField>
    </section>
    <section class="workflow-inspector-section node-inspector">
      <div class="workflow-library-title"><strong>节点配置</strong><span>{{ selectedNode?.kind === 'async' ? '并发控制' : selectedNode ? '资产操作' : '未选择' }}</span></div>
      <WorkflowUpstreamField v-if="selectedNode" :workflow="workflow" :node-id="selectedNode.id" @change="emit('setUpstream', $event)" />
      <WorkflowAsyncInspector
        v-if="selectedNode?.kind === 'async'" :node="selectedNode"
        @update-label="emit('updateAsyncLabel', selectedNode.id, $event)"
        @add-branch="emit('addAsyncBranch', selectedNode.id)"
        @rename-branch="(branchId, label) => emit('renameAsyncBranch', selectedNode!.id, branchId, label)"
        @remove-branch="emit('removeAsyncBranch', selectedNode.id, $event)"
      />
      <template v-else-if="operationNode && operation?.workflow.enabled">
        <div class="workflow-selected-summary"><span><AppIcon name="repository" :size="16" /></span><div><strong>{{ operation.label }}</strong><small>{{ assetLabel || '资产已不存在' }}</small></div></div>
        <p class="workflow-operation-help">{{ operation.description }}</p>
        <template v-if="inputFields.length">
          <AppFormField v-for="field in inputFields" :key="field.name" :field-id="'workflow-input-' + field.name" :label="field.name" :hint="field.description">
            <label v-if="field.type === 'boolean'" class="workflow-boolean-input">
              <AppCheckbox :model-value="Boolean(operationNode.inputs[field.name])" @update:model-value="emit('updateInput', field.name, Boolean($event))" />启用
            </label>
            <AppInput v-else :id="'workflow-input-' + field.name" :model-value="String(operationNode.inputs[field.name] || '')" :required="field.required" @update:model-value="emit('updateInput', field.name, String($event || ''))" />
          </AppFormField>
        </template>
        <p v-else class="workflow-library-empty compact">该操作无需额外参数。</p>
        <WorkflowExceptionInspector
          :key="operationNode.id" :node="operationNode"
          @add-port="emit('addExceptionPort', operationNode.id)"
          @update-port="(portId, code) => emit('updateExceptionPort', operationNode!.id, portId, code)"
          @remove-port="emit('removeExceptionPort', operationNode.id, $event)"
        />
      </template>
      <div v-else class="workflow-library-empty"><strong>选择一个节点</strong><span>点击画板中的节点，维护参数或执行子端点。</span></div>
      <div v-if="selectedNode" class="workflow-node-actions"><AppButton variant="danger-outline" icon="delete" @click="emit('removeNode')">删除节点</AppButton></div>
    </section>
  </aside>
</template>

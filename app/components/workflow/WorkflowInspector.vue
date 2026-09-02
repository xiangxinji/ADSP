<script setup lang="ts">
import { findAssetOperation } from '#shared/config/asset-operations'
import type { ProjectWorkspace, WorkflowDefinition, WorkflowOperationInputValue, WorkflowOperationNode } from '#shared/types/asdp'

const props = defineProps<{
  workflow: WorkflowDefinition
  workspace: ProjectWorkspace
  selectedNode: WorkflowOperationNode | null
}>()

const emit = defineEmits<{
  updateName: [value: string]
  updateNote: [value: string]
  updateInput: [name: string, value: WorkflowOperationInputValue]
  moveNode: [direction: -1 | 1]
  removeNode: []
}>()

const operation = computed(() => props.selectedNode
  ? findAssetOperation(props.selectedNode.assetType, props.selectedNode.operationId)
  : undefined)
const inputFields = computed(() => operation.value?.workflow.enabled
  ? operation.value.contract.input.filter(field => field.name !== `${props.selectedNode?.assetType}Id`)
  : [])
const selectedIndex = computed(() => props.selectedNode
  ? props.workflow.nodes.findIndex(node => node.id === props.selectedNode?.id)
  : -1)

const assetLabel = computed(() => {
  if (!props.selectedNode) return ''
  const { assetType, assetId } = props.selectedNode
  if (assetType === 'repository') return props.workspace.repositories.find(asset => asset.id === assetId)?.name
  if (assetType === 'member') return props.workspace.members.find(asset => asset.id === assetId)?.user.name
  if (assetType === 'environment') return props.workspace.environments.find(asset => asset.id === assetId)?.address
  return props.workspace.knowledge.find(asset => asset.id === assetId)?.title
})
</script>

<template>
  <aside class="workflow-sidebar workflow-inspector" aria-label="工作流配置">
    <div class="workflow-sidebar-heading"><p class="overline">CONFIGURATION</p><h2>配置</h2><span>修改基本信息和当前选中的操作节点。</span></div>
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
      <div class="workflow-library-title"><strong>操作节点</strong><span>{{ selectedNode ? `第 ${selectedIndex + 1} 步` : '未选择' }}</span></div>
      <template v-if="selectedNode && operation?.workflow.enabled">
        <div class="workflow-selected-summary"><span><AppIcon name="repository" :size="16" /></span><div><strong>{{ operation.label }}</strong><small>{{ assetLabel || '资产已不存在' }}</small></div></div>
        <p class="workflow-operation-help">{{ operation.description }}</p>
        <template v-if="inputFields.length">
          <AppFormField v-for="field in inputFields" :key="field.name" :field-id="`workflow-input-${field.name}`" :label="field.name" :hint="field.description">
            <label v-if="field.type === 'boolean'" class="workflow-boolean-input">
              <AppCheckbox :model-value="Boolean(selectedNode.inputs[field.name])" @update:model-value="emit('updateInput', field.name, Boolean($event))" />启用
            </label>
            <AppInput v-else :id="`workflow-input-${field.name}`" :model-value="String(selectedNode.inputs[field.name] || '')" :required="field.required" @update:model-value="emit('updateInput', field.name, String($event || ''))" />
          </AppFormField>
        </template>
        <p v-else class="workflow-library-empty compact">该操作无需额外参数。</p>
        <div class="workflow-node-actions">
          <AppButton variant="secondary" icon="chevron-up" :disabled="selectedIndex <= 0" @click="emit('moveNode', -1)">前移</AppButton>
          <AppButton variant="secondary" icon="chevron-down" :disabled="selectedIndex >= workflow.nodes.length - 1" @click="emit('moveNode', 1)">后移</AppButton>
          <AppButton variant="danger-outline" icon="delete" @click="emit('removeNode')">删除节点</AppButton>
        </div>
      </template>
      <div v-else class="workflow-library-empty"><strong>选择一个操作节点</strong><span>点击画板中的资产操作节点后，可在这里维护输入参数。</span></div>
    </section>
  </aside>
</template>

<script setup lang="ts">
import AssetContractFields from '~/components/asset/AssetContractFields.vue'
import { findAssetOperation, isProjectAssetOperation } from '#shared/config/asset-operations'
import { assetOperationOutputType } from '#shared/utils/asset-operation-contract'
import { isWorkflowControlNode, isWorkflowOperationNode, isWorkflowSubworkflowNode, workflowControlNames } from '#shared/utils/workflow-nodes'
import { workflowAssetSource } from '#shared/utils/workflow-operation-assets'
import { workflowPreviousValueFields } from '~/utils/workflow-value-fields'
import type { ProjectWorkspace, WorkflowDefinition, WorkflowEdge, WorkflowOperationInputValue, WorkflowNode } from '#shared/types/asdp'
import { agentExecutorForOperation } from '#shared/types/agent-executors'

const props = defineProps<{
  workflow: WorkflowDefinition
  workspace: ProjectWorkspace
  selectedNode: WorkflowNode | null
}>()
const emit = defineEmits<{
  updateName: [value: string]
  updateNote: [value: string]
  updateTriggerStatusIds: [statusIds: string[] | undefined]
  updateInput: [name: string, value: WorkflowOperationInputValue]
  updateAssetSource: [source: 'input' | 'fixed']
  updateAssetId: [assetId: string]
  setUpstream: [source: Pick<WorkflowEdge, 'source' | 'sourceHandle'> | null]
  removeNode: []
  updateSubworkflow: [workflowId: string]
  updateSubworkflowLabel: [label: string]
  updateControlLabel: [nodeId: string, label: string]
  addExceptionPort: [nodeId: string]
  updateExceptionPort: [nodeId: string, portId: string, code: string]
  removeExceptionPort: [nodeId: string, portId: string]
}>()
const operationNode = computed(() => isWorkflowOperationNode(props.selectedNode) ? props.selectedNode : null)
const subworkflowNode = computed(() => isWorkflowSubworkflowNode(props.selectedNode) ? props.selectedNode : null)
const controlNode = computed(() => isWorkflowControlNode(props.selectedNode) ? props.selectedNode : null)
const operation = computed(() => operationNode.value
  ? findAssetOperation(operationNode.value.assetType, operationNode.value.operationId) : undefined)
const agentNode = computed(() => operationNode.value && agentExecutorForOperation(operationNode.value.operationId) ? operationNode.value : null)
const inputFields = computed(() => operation.value?.workflow.enabled
  ? operation.value.contract.input.filter(field => !operationNode.value || workflowAssetSource(operationNode.value) === 'input'
    || field.name !== operationNode.value.assetType + 'Id') : [])
const previousFields = computed(() => operationNode.value
  ? workflowPreviousValueFields(props.workflow, operationNode.value.id) : [])
const assetLabel = computed(() => {
  if (!operationNode.value) return ''
  if (agentNode.value) return '引用指定资产 · ' + (agentNode.value.inputs.writable === true ? '读写' : '只读')
  if (isProjectAssetOperation(operation.value)) return '当前项目 · 全部资产'
  if (workflowAssetSource(operationNode.value) === 'input') return '资产来源 · 输入值'
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
    <WorkflowTriggerInspector
      v-if="workflow.trigger?.kind === 'requirement-status-changed'"
      :trigger="workflow.trigger" :statuses="workspace.requirementStatuses"
      @update-status-ids="emit('updateTriggerStatusIds', $event)"
    />
    <section class="workflow-inspector-section node-inspector">
      <div class="workflow-library-title"><strong>节点配置</strong><span>{{ controlNode ? workflowControlNames[controlNode.kind] : subworkflowNode ? '工作流' : selectedNode ? '资产操作' : '未选择' }}</span></div>
      <WorkflowUpstreamField v-if="selectedNode" :workflow="workflow" :node-id="selectedNode.id" @change="emit('setUpstream', $event)" />
      <WorkflowControlInspector
        v-if="controlNode" :key="controlNode.id" :node="controlNode"
        @update-label="emit('updateControlLabel', controlNode.id, $event)"
      />
      <WorkflowSubworkflowInspector
        v-else-if="subworkflowNode" :node="subworkflowNode" :workflow="workflow" :workflows="workspace.workflows"
        @update-workflow="emit('updateSubworkflow', $event)" @update-label="emit('updateSubworkflowLabel', $event)"
      />
      <template v-else-if="operationNode && operation?.workflow.enabled">
        <div class="workflow-selected-summary"><span><AppIcon name="repository" :size="16" /></span><div><strong>{{ operation.label }}</strong><small>{{ assetLabel || '资产已不存在' }}</small></div></div>
        <p class="workflow-operation-help">{{ operation.description }}</p>
        <WorkflowAssetSourceField
          v-if="!isProjectAssetOperation(operation)" :node="operationNode" :workspace="workspace"
          @update-source="emit('updateAssetSource', $event)" @update-asset-id="emit('updateAssetId', $event)"
        />
        <WorkflowAgentInspector v-if="agentNode" :key="agentNode.id" :node="agentNode" :workspace="workspace" @update-input="(name, value) => emit('updateInput', name, value)" />
        <template v-else-if="inputFields.length">
          <WorkflowInputField
            v-for="field in inputFields" :key="field.name" :field="field" :model-value="operationNode.inputs[field.name]"
            :previous-fields="previousFields" @update:model-value="emit('updateInput', field.name, $event)"
          />
        </template>
        <p v-else class="workflow-library-empty compact">该操作无需额外参数。</p>
        <div class="workflow-output-contract">
          <strong>节点输出类型 · {{ assetOperationOutputType(operation.contract) }}</strong>
          <p v-if="'outputType' in operation.contract" class="workflow-operation-help">直接输出资产数组。后续节点可通过 $prev.0.id 引用首项资产 ID；无资产时输出 []。</p>
          <AssetContractFields :fields="operation.contract.output" :prefix="'outputType' in operation.contract ? '[].' : ''" />
        </div>
        <WorkflowExceptionInspector
          :key="operationNode.id" :node="operationNode"
          @add-port="emit('addExceptionPort', operationNode.id)"
          @update-port="(portId, code) => emit('updateExceptionPort', operationNode!.id, portId, code)"
          @remove-port="emit('removeExceptionPort', operationNode.id, $event)"
        />
      </template>
      <div v-else class="workflow-library-empty"><strong>选择一个节点</strong><span>点击画板中的节点，维护参数或查看执行规则。</span></div>
      <div v-if="selectedNode" class="workflow-node-actions"><AppButton variant="danger-outline" icon="delete" @click="emit('removeNode')">删除节点</AppButton></div>
    </section>
  </aside>
</template>

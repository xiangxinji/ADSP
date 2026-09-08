<script setup lang="ts">
import { assetOperationConfig } from '#shared/config/asset-operations'
import type { AssetCommandOperation, AssetType } from '#shared/types/asset-operations'
import type { ProjectWorkspace, WorkflowTriggerKind } from '#shared/types/asdp'
import {
  serializeWorkflowNodeDragData,
  workflowNodeDragMime,
  type WorkflowNodeDragData,
  type WorkflowOperationSelection,
} from '~/utils/workflow-node-drag'

const props = defineProps<{
  workspace: ProjectWorkspace
  triggerKind: WorkflowTriggerKind | null
}>()

const emit = defineEmits<{
  selectTrigger: [kind: WorkflowTriggerKind]
  addAsyncNode: []
  addOperation: [selection: { assetType: AssetType, assetId: string, operationId: string }]
}>()

type WorkflowAssetOption = {
  key: string
  assetType: AssetType
  assetId: string
  label: string
  typeLabel: string
}

const triggerOptions: { kind: WorkflowTriggerKind, label: string, description: string }[] = [
  { kind: 'manual', label: '手动触发', description: '由操作人员输入 JSON 根数据并启动。' },
  { kind: 'requirement-created', label: '需求创建时', description: '为后续需求事件接入预留触发配置。' },
]

const workflowModules = assetOperationConfig.modules
  .map(module => ({
    ...module,
    operations: module.operations.filter(operation => operation.workflow.enabled) as AssetCommandOperation[],
  }))
  .filter(module => module.operations.length)

const assetsForType = (assetType: AssetType) => {
  if (assetType === 'repository') return props.workspace.repositories.map(asset => ({ id: asset.id, label: asset.name }))
  if (assetType === 'member') return props.workspace.members.map(asset => ({ id: asset.id, label: asset.user.name }))
  if (assetType === 'environment') return props.workspace.environments.map(asset => ({ id: asset.id, label: asset.address }))
  return props.workspace.knowledge.map(asset => ({ id: asset.id, label: asset.title }))
}

const assetOptions = computed<WorkflowAssetOption[]>(() => workflowModules.flatMap(module => assetsForType(module.assetType).map(asset => ({
  key: `${module.assetType}:${asset.id}`,
  assetType: module.assetType,
  assetId: asset.id,
  label: asset.label,
  typeLabel: { repository: '代码仓库', member: '项目成员', environment: '环境', knowledge: '知识' }[module.assetType],
}))))

const selectedAssetKey = ref('')
const selectedOperationId = ref('')
const selectedAsset = computed(() => assetOptions.value.find(asset => asset.key === selectedAssetKey.value))
const operationOptions = computed(() => workflowModules
  .find(module => module.assetType === selectedAsset.value?.assetType)?.operations || [])
const selectedOperation = computed(() => operationOptions.value.find(operation => operation.id === selectedOperationId.value))
const draggingSource = ref('')

watch(selectedAssetKey, () => {
  selectedOperationId.value = ''
})

const selectedOperationData = (): WorkflowOperationSelection | null => {
  if (!selectedAsset.value || !selectedOperation.value) return null
  return {
    assetType: selectedAsset.value.assetType,
    assetId: selectedAsset.value.assetId,
    operationId: selectedOperation.value.id,
  }
}

const addOperation = () => {
  const selection = selectedOperationData()
  if (!selection) return
  emit('addOperation', selection)
  selectedOperationId.value = ''
}

const startDrag = (event: DragEvent, data: WorkflowNodeDragData, source: string) => {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(workflowNodeDragMime, serializeWorkflowNodeDragData(data))
  draggingSource.value = source
}

const startAsyncDrag = (event: DragEvent) => {
  if (!props.triggerKind) return event.preventDefault()
  startDrag(event, { type: 'async' }, 'async')
}

const startOperationDrag = (event: DragEvent) => {
  const selection = selectedOperationData()
  if (!props.triggerKind || !selection) return event.preventDefault()
  startDrag(event, { type: 'operation', selection }, 'operation')
}
</script>

<template>
  <aside class="workflow-sidebar workflow-library" aria-label="工作流节点库">
    <div class="workflow-sidebar-heading"><p class="overline">NODE LIBRARY</p><h2>节点库</h2><span id="workflow-node-drag-help">先选择根触发器，再将节点拖入画板；也可以点击添加。</span></div>
    <section class="workflow-library-section">
      <div class="workflow-library-title"><strong>1. 根触发器</strong><span>必须有且只能有一个</span></div>
      <div class="workflow-trigger-options">
        <button v-for="option in triggerOptions" :key="option.kind" type="button" :class="{ active: triggerKind === option.kind }" :aria-pressed="triggerKind === option.kind" @click="emit('selectTrigger', option.kind)">
          <span><AppIcon name="workflow" :size="16" /></span><span><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span><AppIcon v-if="triggerKind === option.kind" name="check" :size="14" />
        </button>
      </div>
    </section>
    <section class="workflow-library-section">
      <div class="workflow-library-title"><strong>2. 流程控制</strong><span>并发执行与结果分流</span></div>
      <p class="workflow-operation-help">动态添加子端点并发执行多个子流程，全部结束后走完成或异常出口。</p>
      <button
        type="button" class="workflow-node-template" :class="{ dragging: draggingSource === 'async' }"
        :disabled="!triggerKind" :draggable="Boolean(triggerKind)" aria-describedby="workflow-node-drag-help"
        @click="emit('addAsyncNode')" @dragstart="startAsyncDrag" @dragend="draggingSource = ''"
      >
        <span class="workflow-node-template-icon"><AppIcon name="workflow" :size="16" /></span>
        <span class="workflow-node-template-copy"><strong>异步执行</strong><small>并发执行子流程</small></span>
        <span class="workflow-node-template-action">拖动</span>
      </button>
    </section>
    <section class="workflow-library-section">
      <div class="workflow-library-title"><strong>3. 资产操作</strong><span>按共享操作契约生成节点</span></div>
      <p class="workflow-connection-guide">把节点模板拖到画板中的目标位置。添加后可直接拖动端口连线；资产操作还支持红色异常端点。</p>
      <template v-if="assetOptions.length">
        <AppFormField field-id="workflow-asset" label="选择资产">
          <AppSelect id="workflow-asset" v-model="selectedAssetKey"><option value="">请选择资产</option><option v-for="asset in assetOptions" :key="asset.key" :value="asset.key">{{ asset.typeLabel }} · {{ asset.label }}</option></AppSelect>
        </AppFormField>
        <AppFormField field-id="workflow-operation" label="选择操作">
          <AppSelect id="workflow-operation" v-model="selectedOperationId" :disabled="!selectedAsset"><option value="">请选择操作</option><option v-for="operation in operationOptions" :key="operation.id" :value="operation.id">{{ operation.label }}</option></AppSelect>
        </AppFormField>
        <p v-if="selectedOperation" class="workflow-operation-help">{{ selectedOperation.description }}</p>
        <button
          type="button" class="workflow-node-template operation" :class="{ dragging: draggingSource === 'operation' }"
          :disabled="!triggerKind || !selectedOperation" :draggable="Boolean(triggerKind && selectedOperation)"
          aria-describedby="workflow-node-drag-help" @click="addOperation" @dragstart="startOperationDrag" @dragend="draggingSource = ''"
        >
          <span class="workflow-node-template-icon"><AppIcon name="add" :size="16" /></span>
          <span class="workflow-node-template-copy"><strong>{{ selectedOperation?.label || '先选择操作' }}</strong><small>{{ selectedAsset ? `${selectedAsset.typeLabel} · ${selectedAsset.label}` : '选择资产后可添加节点' }}</small></span>
          <span class="workflow-node-template-action">拖动</span>
        </button>
      </template>
      <div v-else class="workflow-library-empty"><strong>暂无可用操作</strong><span>请先添加包含 workflow-ready 操作的项目资产。</span></div>
    </section>
  </aside>
</template>

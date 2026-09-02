<script setup lang="ts">
import { findAssetOperation } from '#shared/config/asset-operations'
import type { AssetType } from '#shared/types/asset-operations'
import type { ProjectWorkspace, WorkflowDefinition, WorkflowOperationInputValue, WorkflowTriggerKind } from '#shared/types/asdp'

const route = useRoute()
const projectId = String(route.params.projectId || '')
const workflowId = String(route.params.workflowId || '')
const { data: workspace, status, error, refresh } = await useFetch<ProjectWorkspace>(`/api/projects/${projectId}`)
const sourceWorkflow = workspace.value?.workflows.find(workflow => workflow.id === workflowId)

if (workspace.value && !sourceWorkflow) {
  throw createError({ statusCode: 404, statusMessage: '工作流不存在' })
}

const cloneWorkflow = (workflow: WorkflowDefinition): WorkflowDefinition => ({
  ...workflow,
  trigger: workflow.trigger ? { ...workflow.trigger, position: { ...workflow.trigger.position } } : null,
  nodes: workflow.nodes.map(node => ({
    ...node,
    inputs: { ...node.inputs },
    position: { ...node.position },
  })),
})

const draft = ref<WorkflowDefinition | null>(sourceWorkflow ? cloneWorkflow(sourceWorkflow) : null)
const savedSnapshot = ref(draft.value ? JSON.stringify(draft.value) : '')
const selectedNodeId = ref<string | null>(null)
const saving = ref(false)
const actionError = ref('')
const { success } = useAppToast()

const selectedNode = computed(() => draft.value?.nodes.find(node => node.id === selectedNodeId.value) || null)
const dirty = computed(() => Boolean(draft.value && JSON.stringify(draft.value) !== savedSnapshot.value))

const assetExists = (assetType: AssetType, assetId: string) => {
  if (!workspace.value) return false
  if (assetType === 'repository') return workspace.value.repositories.some(asset => asset.id === assetId)
  if (assetType === 'member') return workspace.value.members.some(asset => asset.id === assetId)
  if (assetType === 'environment') return workspace.value.environments.some(asset => asset.id === assetId)
  return workspace.value.knowledge.some(asset => asset.id === assetId)
}

const validationMessage = computed(() => {
  if (!draft.value?.name.trim()) return '请填写工作流名称。'
  if (!draft.value.trigger) return '请选择一个根触发器。'
  for (const node of draft.value.nodes) {
    const operation = findAssetOperation(node.assetType, node.operationId)
    if (!assetExists(node.assetType, node.assetId)) return '存在已删除或不属于当前项目的资产节点。'
    if (!operation?.workflow.enabled) return '存在不可用于工作流的资产操作。'
    const missing = operation.contract.input.find(field => field.required && (node.inputs[field.name] === undefined || node.inputs[field.name] === ''))
    if (missing) return `节点“${operation.label}”缺少参数 ${missing.name}。`
  }
  return ''
})

const selectTrigger = (kind: WorkflowTriggerKind) => {
  if (!draft.value) return
  draft.value.trigger = {
    kind,
    position: draft.value.trigger?.position || { x: 260, y: 80 },
  }
}

const addOperation = (selection: { assetType: AssetType, assetId: string, operationId: string }) => {
  if (!draft.value) return
  const operation = findAssetOperation(selection.assetType, selection.operationId)
  if (!operation?.workflow.enabled) return
  const inputs: Record<string, WorkflowOperationInputValue> = {}
  operation.contract.input.forEach((field) => {
    if (field.name === `${selection.assetType}Id`) inputs[field.name] = selection.assetId
    else inputs[field.name] = field.type === 'boolean' ? false : ''
  })
  const previousPosition = draft.value.nodes.at(-1)?.position
  const node = {
    id: globalThis.crypto.randomUUID(),
    ...selection,
    inputs,
    position: previousPosition ? { x: previousPosition.x, y: previousPosition.y + 170 } : { x: 260, y: 250 },
  }
  draft.value.nodes.push(node)
  selectedNodeId.value = node.id
}

const updatePosition = (id: string, position: { x: number, y: number }) => {
  if (!draft.value) return
  if (id === 'workflow-trigger' && draft.value.trigger) draft.value.trigger.position = position
  const node = draft.value.nodes.find(item => item.id === id)
  if (node) node.position = position
}

const updateInput = (name: string, value: WorkflowOperationInputValue) => {
  if (selectedNode.value) selectedNode.value.inputs[name] = value
}

const moveNode = (direction: -1 | 1) => {
  if (!draft.value || !selectedNode.value) return
  const index = draft.value.nodes.findIndex(node => node.id === selectedNode.value?.id)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= draft.value.nodes.length) return
  const current = draft.value.nodes[index]
  const target = draft.value.nodes[targetIndex]
  const currentPosition = current.position
  current.position = target.position
  target.position = currentPosition
  draft.value.nodes.splice(index, 1, target)
  draft.value.nodes.splice(targetIndex, 1, current)
}

const removeNode = () => {
  if (!draft.value || !selectedNode.value) return
  draft.value.nodes = draft.value.nodes.filter(node => node.id !== selectedNode.value?.id)
  selectedNodeId.value = null
}

const save = async () => {
  if (!draft.value || validationMessage.value) return
  saving.value = true
  actionError.value = ''
  try {
    const workflow = await $fetch<WorkflowDefinition>(`/api/workflows/${workflowId}`, {
      method: 'PATCH',
      body: {
        name: draft.value.name,
        note: draft.value.note,
        trigger: draft.value.trigger,
        nodes: draft.value.nodes,
      },
    })
    draft.value = cloneWorkflow(workflow)
    savedSnapshot.value = JSON.stringify(draft.value)
    success('工作流已保存')
  } catch (requestError: any) {
    actionError.value = requestError?.data?.statusMessage || requestError?.message || '保存工作流失败'
  } finally {
    saving.value = false
  }
}

onBeforeRouteLeave(() => !dirty.value || window.confirm('工作流还有未保存的修改，确定离开吗？'))
const beforeUnload = (event: BeforeUnloadEvent) => {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div class="app-frame workflow-editor-frame">
    <AppHeader />
    <main v-if="workspace && draft" id="main-content" class="workflow-editor-page">
      <header class="workflow-editor-toolbar">
        <AppButton variant="plain" icon="arrow-left" :to="`/projects/${projectId}/workflows`" aria-label="返回工作流列表" />
        <div class="workflow-editor-title"><span class="workflow-editor-icon"><AppIcon name="workflow" :size="18" /></span><div><strong>{{ draft.name || '未命名工作流' }}</strong><small>{{ dirty ? '有未保存修改' : '已保存' }} · {{ draft.nodes.length }} 个操作节点</small></div></div>
        <p v-if="validationMessage" class="workflow-toolbar-hint" role="status">{{ validationMessage }}</p>
        <p v-if="actionError" class="workflow-toolbar-error" role="alert">{{ actionError }}</p>
        <AppButton icon="save" :busy="saving" busy-label="保存中…" :disabled="Boolean(validationMessage) || !dirty" @click="save">保存工作流</AppButton>
      </header>
      <div class="workflow-editor-layout">
        <WorkflowNodeLibrary :workspace="workspace" :trigger-kind="draft.trigger?.kind || null" @select-trigger="selectTrigger" @add-operation="addOperation" />
        <WorkflowCanvas :trigger="draft.trigger" :nodes="draft.nodes" :workspace="workspace" :selected-node-id="selectedNodeId" @select-node="selectedNodeId = $event" @update-position="updatePosition" />
        <WorkflowInspector :workflow="draft" :workspace="workspace" :selected-node="selectedNode" @update-name="draft.name = $event" @update-note="draft.note = $event" @update-input="updateInput" @move-node="moveNode" @remove-node="removeNode" />
      </div>
    </main>
    <main v-else id="main-content" class="page"><AppAsyncState :pending="status === 'pending'" :error-message="error?.statusMessage || '工作流不存在'" @retry="refresh" /></main>
  </div>
</template>

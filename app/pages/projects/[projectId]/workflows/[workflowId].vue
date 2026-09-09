<script setup lang="ts">
import type { ProjectWorkspace, WorkflowValueObject } from '#shared/types/asdp'
import type { WorkflowNodeDropData } from '~/utils/workflow-node-drag'

const route = useRoute()
const projectId = String(route.params.projectId || '')
const workflowId = String(route.params.workflowId || '')
const { data: workspace, status, error, refresh } = await useFetch<ProjectWorkspace>(`/api/projects/${projectId}`)
const {
  draft, selectedNodeId, selectedNode, dirty, saving, actionError, validationMessage,
  save, selectTrigger, addOperation, updatePosition, updateInput, removeNode, connectEdge, removeEdge, setUpstream,
  addAsyncNode, addAsyncBranch, updateAsyncLabel, renameAsyncBranch, removeAsyncBranch,
  addExceptionPort, updateExceptionPort, removeExceptionPort,
  updateAssetSource, updateAssetId,
} = useWorkflowEditor(workflowId, workspace)
const {
  runs, selectedRunId, selectedRun, running, starting, loading: runsLoading,
  loadError: runsError, startError, startRun, refreshRuns,
} = useWorkflowRuns(workflowId)
const showRuns = ref(false)
const runDialogOpen = ref(false)
const runNodeId = ref<string | null>(null)
const displayedWorkflow = computed(() => showRuns.value && selectedRun.value ? selectedRun.value.workflow : draft.value!)
const runDisabledReason = computed(() => {
  if (running.value) return '工作流正在执行'
  if (runsLoading.value || runsError.value) return '正在确认运行状态，请稍后再试'
  if (validationMessage.value) return validationMessage.value
  if (draft.value?.trigger?.kind !== 'manual') return '仅手动触发器支持主动运行'
  if (!draft.value.nodes.length) return '请至少添加并连接一个操作节点'
  return ''
})
watch(() => selectedRun.value?.id, () => { runNodeId.value = null })
watch(running, (active) => { if (active) showRuns.value = true })

const runWorkflow = async () => {
  if (saving.value || runDisabledReason.value) return
  if (dirty.value && !await save()) return
  runDialogOpen.value = true
}
const confirmRun = async (root: WorkflowValueObject) => {
  if (!await startRun(root)) return
  runDialogOpen.value = false
  showRuns.value = true
}
const addDroppedNode = (data: WorkflowNodeDropData) => {
  if (data.type === 'async') addAsyncNode(data.position)
  else addOperation(data.selection, data.position)
}
</script>

<template>
  <div class="app-frame workflow-editor-frame">
    <AppHeader />
    <main v-if="workspace && draft" id="main-content" class="workflow-editor-page">
      <header class="workflow-editor-toolbar">
        <AppButton variant="plain" icon="arrow-left" :to="`/projects/${projectId}/workflows`" aria-label="返回工作流列表" />
        <div class="workflow-editor-title"><span class="workflow-editor-icon"><AppIcon name="workflow" :size="18" /></span><div><strong>{{ draft.name || '未命名工作流' }}</strong><small>{{ dirty ? '有未保存修改' : '已保存' }} · {{ draft.nodes.length }} 个节点</small></div></div>
        <p v-if="validationMessage" class="workflow-toolbar-hint" role="status">{{ validationMessage }}</p>
        <p v-if="actionError || startError" class="workflow-toolbar-error" role="alert">{{ actionError || startError }}</p>
        <div class="workflow-toolbar-actions">
          <AppButton variant="secondary" :aria-pressed="showRuns" @click="showRuns = !showRuns">{{ showRuns ? '返回编排' : '执行记录' }}</AppButton>
          <AppButton variant="secondary" icon="save" :busy="saving" busy-label="保存中…" :disabled="Boolean(validationMessage) || !dirty || starting" @click="save">保存工作流</AppButton>
          <AppButton icon="play" :busy="running" :busy-label="starting ? '启动中…' : '运行中…'" :disabled="saving || Boolean(runDisabledReason)" :title="runDisabledReason || '按连线顺序执行所有节点；失败时停止，不自动重试'" @click="runWorkflow">{{ dirty ? '保存并运行' : '运行工作流' }}</AppButton>
        </div>
      </header>
      <div class="workflow-editor-layout">
        <WorkflowNodeLibrary v-if="!showRuns" :trigger-kind="draft.trigger?.kind || null" @select-trigger="selectTrigger" @add-operation="addOperation" @add-async-node="addAsyncNode" />
        <aside v-else class="workflow-sidebar workflow-library">
          <header class="workflow-sidebar-heading"><p class="overline">RUN SNAPSHOT</p><h2>运行快照</h2><span>{{ selectedRun?.workflow.name || draft.name }}</span></header>
          <p class="workflow-run-help">画布展示本次启动时保存的节点与连线，只读查看。之后的编排修改不会改变历史结果。</p>
          <p class="workflow-run-help">高亮边框标记正在执行的节点；点击任意节点，在右侧查看该节点的执行结果。</p>
          <p class="workflow-run-help">关闭页面不会停止执行。再次进入「执行记录」可继续查看进度。</p>
        </aside>
        <WorkflowCanvas
          :key="showRuns ? selectedRun?.id || 'history' : 'editor'"
          :trigger="displayedWorkflow.trigger" :nodes="displayedWorkflow.nodes" :edges="displayedWorkflow.edges"
          :workspace="workspace" :selected-node-id="showRuns ? runNodeId : selectedNodeId"
          :run-steps="showRuns ? selectedRun?.steps : undefined" :read-only="showRuns"
          @select-node="showRuns ? runNodeId = $event : selectedNodeId = $event"
          @update-position="updatePosition" @connect-edge="connectEdge" @remove-edge="removeEdge"
          @add-async-branch="addAsyncBranch"
          @add-exception-port="addExceptionPort"
          @drop-node="addDroppedNode"
        />
        <WorkflowRunPanel v-if="showRuns" :runs="runs" :run="selectedRun" :selected-node-id="runNodeId" :loading="runsLoading" :error="runsError" @select-run="selectedRunId = $event" @select-node="runNodeId = $event" @retry="refreshRuns" />
        <WorkflowInspector
          v-else :workflow="draft" :workspace="workspace" :selected-node="selectedNode"
          @update-name="draft.name = $event" @update-note="draft.note = $event" @update-input="updateInput"
          @update-asset-source="updateAssetSource" @update-asset-id="updateAssetId"
          @set-upstream="setUpstream" @remove-node="removeNode" @add-async-branch="addAsyncBranch"
          @update-async-label="updateAsyncLabel" @rename-async-branch="renameAsyncBranch" @remove-async-branch="removeAsyncBranch"
          @add-exception-port="addExceptionPort" @update-exception-port="updateExceptionPort" @remove-exception-port="removeExceptionPort"
        />
      </div>
    </main>
    <main v-else id="main-content" class="page"><AppAsyncState :pending="status === 'pending'" :error-message="error?.statusMessage || '工作流不存在'" @retry="refresh" /></main>
    <WorkflowRunDialog
      :open="runDialogOpen" :busy="starting" :default-root="selectedRun?.root || {}" :error="startError"
      @close="runDialogOpen = false" @run="confirmRun"
    />
  </div>
</template>

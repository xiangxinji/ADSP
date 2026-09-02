<script setup lang="ts">
import type { ProjectWorkspace, WorkflowDefinition, WorkflowTriggerKind } from '#shared/types/asdp'
import { analyzeWorkflowGraph } from '#shared/utils/workflow-graph'

defineProps<{ workspace: ProjectWorkspace, projectId: string }>()
const emit = defineEmits<{ refresh: [] }>()
const createDialog = ref<InstanceType<typeof import('../workflow/WorkflowCreateDialog.vue')['default']> | null>(null)
const deletingWorkflow = ref<WorkflowDefinition | null>(null)
const deleting = ref(false)
const actionError = ref('')
const { success } = useAppToast()

const triggerLabel = (kind?: WorkflowTriggerKind) => ({
  manual: '手动触发',
  'requirement-created': '需求创建时',
})[kind || 'manual']
const workflowConfigured = (workflow: WorkflowDefinition) => Boolean(workflow.trigger && !analyzeWorkflowGraph(
  workflow.nodes.map(node => node.id),
  workflow.edges,
  true,
).message)

const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value))

const removeWorkflow = async () => {
  if (!deletingWorkflow.value) return
  const workflow = deletingWorkflow.value
  deleting.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/workflows/${workflow.id}`, { method: 'DELETE' })
    deletingWorkflow.value = null
    emit('refresh')
    success(`“${workflow.name}”已删除`)
  } catch (error: any) {
    actionError.value = error?.data?.statusMessage || error?.message || '删除工作流失败'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="module-section workflow-list-section">
    <div class="section-heading">
      <div><p class="overline">WORKFLOW DEFINITIONS</p><h2>工作流</h2><p>先创建基本信息，再进入画板组合触发器和资产操作。</p></div>
      <AppButton icon="add" @click="createDialog?.open()">新建工作流</AppButton>
    </div>
    <p v-if="actionError" class="alert error-state" role="alert">{{ actionError }}</p>
    <div v-if="workspace.workflows.length" class="workflow-card-grid">
      <article v-for="workflow in workspace.workflows" :key="workflow.id" class="panel workflow-card">
        <div class="workflow-card-icon"><AppIcon name="workflow" :size="20" /></div>
        <div class="workflow-card-copy">
          <div class="workflow-card-title"><strong>{{ workflow.name }}</strong><span :class="workflowConfigured(workflow) ? 'configured' : 'draft'">{{ workflowConfigured(workflow) ? '已配置' : '草稿' }}</span></div>
          <p>{{ workflow.note || '暂无备注' }}</p>
          <div class="workflow-card-meta"><span>{{ workflow.trigger ? triggerLabel(workflow.trigger.kind) : '未选择触发器' }}</span><span>{{ workflow.nodes.length }} 个操作节点</span><span>更新于 {{ formatDate(workflow.updatedAt) }}</span></div>
        </div>
        <div class="workflow-card-actions">
          <AppButton variant="secondary" icon="workflow" :to="`/projects/${projectId}/workflows/${workflow.id}`">进入画板</AppButton>
          <AppButton variant="text-danger" @click="deletingWorkflow = workflow">删除</AppButton>
        </div>
      </article>
    </div>
    <div v-else class="panel empty-state">
      <span class="workflow-empty-icon"><AppIcon name="workflow" :size="24" /></span>
      <strong>还没有工作流</strong><span>创建基本信息后，从根触发器开始配置第一条交付流程。</span>
      <AppButton icon="add" @click="createDialog?.open()">新建第一个工作流</AppButton>
    </div>
  </section>
  <WorkflowCreateDialog ref="createDialog" :project-id="projectId" />
  <AppConfirmDialog :open="Boolean(deletingWorkflow)" :title="`删除“${deletingWorkflow?.name || ''}”？`" description="工作流定义及其节点配置将被永久删除。" confirm-label="确认删除" :busy="deleting" danger @cancel="deletingWorkflow = null" @confirm="removeWorkflow" />
</template>

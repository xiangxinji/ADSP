<script setup lang="ts">
import type { ProjectWorkspace, Requirement, RequirementPriority } from '#shared/types/asdp'

type DialogHandle<T = void> = { open: (value?: T) => void }

const props = defineProps<{
  workspace: ProjectWorkspace
  projectId: string
}>()

const emit = defineEmits<{ refresh: [] }>()
const requirementDialog = ref<DialogHandle<Requirement> | null>(null)
const statusDialog = ref<DialogHandle | null>(null)
const versionDialog = ref<DialogHandle | null>(null)
const deletingRequirement = ref<Requirement | null>(null)
const deleting = ref(false)
const actionError = ref('')
const { success } = useAppToast()

const priorityLabel = (value: RequirementPriority) => ({ low: '低', medium: '中', high: '高', urgent: '紧急' })[value]
const statusStyle = (color: string) => ({ '--status-color': color })
const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

const removeRequirement = async () => {
  if (!deletingRequirement.value) return
  const requirement = deletingRequirement.value
  deleting.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/requirements/${requirement.id}`, { method: 'DELETE' })
    deletingRequirement.value = null
    emit('refresh')
    success(`“${requirement.title}”已删除`)
  } catch (error: any) {
    actionError.value = error?.data?.statusMessage || error?.message || '操作失败'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="module-section">
    <div class="section-heading">
      <div><h2>需求管理</h2><p>需求引用项目资产，并作为后续工作流运行的业务入口。</p></div>
      <div class="heading-actions">
        <AppButton variant="secondary" icon="versions" @click="versionDialog?.open()">版本管理</AppButton>
        <AppButton variant="secondary" icon="status" @click="statusDialog?.open()">状态管理</AppButton>
        <AppButton icon="add" @click="requirementDialog?.open()">新建需求</AppButton>
      </div>
    </div>
    <p v-if="actionError" class="alert error-state" role="alert">{{ actionError }}</p>
    <div v-if="workspace.requirements.length" class="requirement-list">
      <article v-for="requirement in workspace.requirements" :key="requirement.id" class="panel requirement-card">
        <div class="requirement-main">
          <div class="requirement-title-line">
            <h3>{{ requirement.title }}</h3>
            <span class="status dynamic-status" :style="statusStyle(requirement.status.color)">{{ requirement.status.name }}</span>
            <span class="priority" :data-priority="requirement.priority">{{ priorityLabel(requirement.priority) }}</span>
          </div>
          <p>{{ requirement.description || '暂无需求说明' }}</p>
          <div class="asset-references">
            <span v-for="version in requirement.versions" :key="version.id" class="chip version-chip">{{ version.name }}<em v-if="version.isLatest">latest</em></span>
            <span v-for="repository in requirement.repositories" :key="repository.id" class="chip repo-chip"><AppIcon name="repository" :size="13" />{{ repository.name }}</span>
            <span v-for="member in requirement.members" :key="member.id" class="chip member-chip">{{ member.user.name }}</span>
            <span v-if="!requirement.versions.length && !requirement.repositories.length && !requirement.members.length" class="unbound">尚未关联版本或资产</span>
          </div>
        </div>
        <div class="requirement-meta">
          <span>更新于 {{ formatDate(requirement.updatedAt) }}</span>
          <div><AppButton variant="text" icon="edit" @click="requirementDialog?.open(requirement)">编辑</AppButton><AppButton variant="text-danger" icon="delete" @click="deletingRequirement = requirement">删除</AppButton></div>
        </div>
      </article>
    </div>
    <div v-else class="panel empty-state"><strong>还没有需求</strong><span>创建第一条需求，并绑定代码仓库和项目成员。</span><AppButton icon="add" @click="requirementDialog?.open()">新建需求</AppButton></div>
  </section>

  <ProjectRequirementDialog ref="requirementDialog" :workspace="workspace" :project-id="projectId" @saved="emit('refresh')" />
  <ProjectRequirementStatusDialog ref="statusDialog" :workspace="workspace" :project-id="projectId" @saved="emit('refresh')" />
  <ProjectRequirementVersionDialog ref="versionDialog" :workspace="workspace" :project-id="projectId" @saved="emit('refresh')" />
  <AppConfirmDialog :open="Boolean(deletingRequirement)" :title="`删除“${deletingRequirement?.title || ''}”？`" description="删除后无法恢复。" confirm-label="确认删除" :busy="deleting" danger @cancel="deletingRequirement = null" @confirm="removeRequirement" />
</template>

<script setup lang="ts">
import { assetOperationsForModule } from '#shared/config/asset-operations'
import type { AssetOperationDefinition } from '#shared/types/asset-operations'
import type { ProjectMember, ProjectWorkspace } from '#shared/types/asdp'

type DialogHandle = { open: (member?: ProjectMember) => void }

defineProps<{
  workspace: ProjectWorkspace
  projectId: string
}>()

const emit = defineEmits<{ refresh: [] }>()
const operations = assetOperationsForModule('members')
const editor = ref<DialogHandle | null>(null)
const deletingMember = ref<ProjectMember | null>(null)
const deleting = ref(false)
const actionError = ref('')
const { success } = useAppToast()

const runOperation = (member: ProjectMember, operation: AssetOperationDefinition) => {
  if (operation.id === 'member.edit') return editor.value?.open(member)
  if (operation.id === 'member.remove') deletingMember.value = member
}

const removeMember = async () => {
  if (!deletingMember.value) return
  const member = deletingMember.value
  deleting.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/members/${member.id}`, { method: 'DELETE' })
    deletingMember.value = null
    emit('refresh')
    success(`“${member.user.name}”已移除`)
  } catch (error: any) {
    actionError.value = error?.data?.statusMessage || error?.message || '操作失败'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="module-section assets-module">
    <div class="asset-detail-heading">
      <div class="section-heading">
        <div><p class="overline">PROJECT MEMBERS</p><h2>项目成员</h2><p>选择全局用户加入项目，并维护其项目角色。</p></div>
        <AppButton icon="add" @click="editor?.open()">添加成员</AppButton>
      </div>
    </div>
    <AssetOperationCatalog :operations="operations" />
    <p v-if="actionError" class="alert error-state" role="alert">{{ actionError }}</p>
    <div v-if="workspace.members.length" class="asset-record-list" role="region" aria-label="项目成员列表" tabindex="0">
      <article v-for="member in workspace.members" :id="`asset-${member.id}`" :key="member.id" class="panel asset-card asset-record-card">
        <div class="asset-icon member-icon">{{ member.user.name.slice(0, 1) }}</div>
        <div class="asset-copy"><strong>{{ member.user.name }}</strong><span>{{ member.user.email }}</span><small>{{ member.role }} · 被 {{ member.referenceCount }} 条需求引用</small></div>
        <div class="asset-actions"><AssetActionMenu :operations="operations" @select="runOperation(member, $event)" /></div>
      </article>
    </div>
    <div v-else class="panel empty-state">
      <strong>还没有项目成员</strong><span>从全局用户中选择成员，并为其设置项目角色。</span>
      <AppButton icon="add" @click="editor?.open()">添加第一位成员</AppButton>
    </div>
  </section>
  <ProjectMemberDialog ref="editor" :workspace="workspace" :project-id="projectId" @saved="emit('refresh')" />
  <AppConfirmDialog
    :open="Boolean(deletingMember)"
    :title="`删除“${deletingMember?.user.name || ''}”？`"
    :description="`删除后无法恢复${deletingMember?.referenceCount ? `，并从 ${deletingMember.referenceCount} 条需求中移除引用` : ''}。`"
    confirm-label="移除成员"
    :busy="deleting"
    danger
    @cancel="deletingMember = null"
    @confirm="removeMember"
  />
</template>

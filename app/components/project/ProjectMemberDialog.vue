<script setup lang="ts">
import type { ProjectMember, ProjectWorkspace, UserAccount } from '#shared/types/asdp'

const props = defineProps<{
  workspace: ProjectWorkspace
  projectId: string
}>()

const emit = defineEmits<{ saved: [] }>()
const { data: users, status: usersStatus, error: usersError } = await useFetch<UserAccount[]>('/api/users')
const isOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const actionError = ref('')
const showDiscardConfirm = ref(false)
const snapshot = ref('')
const form = reactive({ userId: '', role: '项目成员' })
const { success } = useAppToast()

const selectableUsers = computed(() => {
  const assignedUserIds = new Set(props.workspace.members.map(member => member.userId))
  return (users.value || []).filter(user => user.id === (editingId.value ? form.userId : '') || !assignedUserIds.has(user.id))
})
const errorMessage = (error: any) => error?.data?.statusMessage || error?.message || '操作失败'

const open = (member?: ProjectMember) => {
  editingId.value = member?.id || null
  Object.assign(form, member ? { userId: member.userId, role: member.role } : { userId: selectableUsers.value[0]?.id || '', role: '项目成员' })
  actionError.value = ''
  snapshot.value = JSON.stringify(form)
  isOpen.value = true
}

const close = () => {
  isOpen.value = false
  editingId.value = null
  actionError.value = ''
}

const requestClose = () => {
  if (saving.value) return
  if (JSON.stringify(form) !== snapshot.value) {
    showDiscardConfirm.value = true
    return
  }
  close()
}

const save = async () => {
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(editingId.value ? `/api/members/${editingId.value}` : `/api/projects/${props.projectId}/members`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: form,
    })
    emit('saved')
    close()
    success('项目成员已保存')
  } catch (error) {
    actionError.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <AppDialog :open="isOpen" :title="editingId ? '编辑成员角色' : '添加项目成员'" overline="PROJECT MEMBER" :busy="saving" @request-close="requestClose">
    <form id="member-form" @submit.prevent="save">
      <p class="dialog-intro">从全局用户中选择项目成员，并定义其在当前项目中的角色。</p>
      <div class="field">
        <label for="member-user">用户</label>
        <AppSelect id="member-user" v-model="form.userId" required autofocus :disabled="Boolean(editingId) || usersStatus === 'pending'">
          <option v-for="user in selectableUsers" :key="user.id" :value="user.id">{{ user.name }} · {{ user.email }}</option>
        </AppSelect>
        <small v-if="editingId">成员身份不可更换，只能修改项目角色。</small>
        <small v-else-if="usersStatus === 'pending'">正在读取全局用户…</small>
        <small v-else-if="usersError">全局用户读取失败，请稍后重试。</small>
        <small v-else-if="!selectableUsers.length">没有可添加的用户，请先前往 <NuxtLink to="/users">用户管理</NuxtLink> 新增用户。</small>
      </div>
      <AppFormField field-id="member-role" label="项目角色" hint="角色只在当前项目内生效。"><AppInput id="member-role" v-model="form.role" required placeholder="例如：技术负责人" /></AppFormField>
      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    </form>
    <template #actions>
      <AppButton variant="secondary" :disabled="saving" @click="requestClose">取消</AppButton>
      <AppButton type="submit" form="member-form" :icon="editingId ? 'save' : 'add'" :busy="saving" busy-label="保存中…" :disabled="!form.userId">{{ editingId ? '保存角色' : '添加成员' }}</AppButton>
    </template>
  </AppDialog>
  <AppConfirmDialog :open="showDiscardConfirm" title="放弃未保存的修改？" description="当前弹框中的修改尚未保存，放弃后无法恢复。" confirm-label="放弃修改" danger @cancel="showDiscardConfirm = false" @confirm="showDiscardConfirm = false; close()" />
</template>

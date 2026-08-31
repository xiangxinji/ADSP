<script setup lang="ts">
import type { UserAccount, UserRole } from '#shared/types/asdp'

const { data: users, status, error, refresh } = await useFetch<UserAccount[]>('/api/users')
const showCreateDialog = ref(false)
const showDiscardConfirm = ref(false)
const saving = ref(false)
const actionError = ref('')
const form = reactive({ name: '', email: '', role: 'member' as UserRole })
const initialForm = ref('')
const { success } = useAppToast()

const roleOptions: { value: UserRole, label: string }[] = [
  { value: 'administrator', label: '平台管理员' },
  { value: 'member', label: '普通成员' },
]

const roleLabel = (role: UserRole) => roleOptions.find(option => option.value === role)?.label || role
const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
}).format(new Date(value))

const openCreateDialog = () => {
  Object.assign(form, { name: '', email: '', role: 'member' })
  actionError.value = ''
  initialForm.value = JSON.stringify(form)
  showCreateDialog.value = true
}

const closeCreateDialog = () => {
  showCreateDialog.value = false
  actionError.value = ''
}

const requestCloseCreateDialog = () => {
  if (saving.value) return
  if (JSON.stringify(form) !== initialForm.value) {
    showDiscardConfirm.value = true
    return
  }
  closeCreateDialog()
}

const discardCreateDialog = () => {
  showDiscardConfirm.value = false
  closeCreateDialog()
}

const createUser = async () => {
  saving.value = true
  actionError.value = ''
  try {
    const user = await $fetch<UserAccount>('/api/users', {
      method: 'POST',
      body: form,
    })
    await refresh()
    closeCreateDialog()
    success(`用户“${user.name}”已新增`)
  } catch (requestError: any) {
    actionError.value = requestError?.data?.statusMessage || requestError?.message || '新增用户失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="app-frame">
    <AppHeader badge="Architecture Preview" />

    <main id="main-content" class="page users-page">
      <section class="page-title-row">
        <div>
          <p class="overline">IDENTITY</p>
          <h1>用户管理</h1>
          <p>管理 ForgePilot 平台用户。用户是全局身份，不归属于任何项目。</p>
        </div>
        <button class="button primary" type="button" @click="openCreateDialog">新增用户</button>
      </section>

      <AppAsyncState v-if="status === 'pending' || error" :pending="status === 'pending'" :error-message="error?.statusMessage" @retry="refresh" />
      <section v-else-if="users?.length" class="panel user-list" aria-label="用户列表">
        <div class="user-list-heading">
          <div><strong>全部用户</strong><span>共 {{ users.length }} 位</span></div>
          <span>{{ users.filter(user => user.role === 'administrator').length }} 位管理员</span>
        </div>
        <div class="user-table-heading" aria-hidden="true"><span>用户</span><span>平台角色</span><span>新增时间</span></div>
        <article v-for="user in users" :key="user.id" class="user-row">
          <div class="user-identity">
            <span class="user-avatar">{{ user.name.slice(0, 1).toUpperCase() }}</span>
            <span><strong>{{ user.name }}</strong><small>{{ user.email }}</small></span>
          </div>
          <span class="user-role" :data-role="user.role">{{ roleLabel(user.role) }}</span>
          <time :datetime="user.createdAt">{{ formatDate(user.createdAt) }}</time>
        </article>
      </section>
      <div v-else class="panel empty-state"><strong>还没有用户</strong><span>新增第一位平台用户，建立 ForgePilot 的全局身份目录。</span><button class="button primary" type="button" @click="openCreateDialog">新增用户</button></div>
    </main>

    <AppDialog :open="showCreateDialog" title="新增用户" overline="NEW USER" @request-close="requestCloseCreateDialog">
        <form id="create-user-form" @submit.prevent="createUser">
          <p class="dialog-intro">创建全局平台身份。项目成员关系将在项目授权中单独配置。</p>
          <div class="field"><label for="user-name">姓名</label><input id="user-name" v-model="form.name" required autofocus placeholder="例如：陈嘉" /></div>
          <div class="field"><label for="user-email">邮箱</label><input id="user-email" v-model="form.email" required type="email" autocomplete="email" placeholder="name@example.com" /></div>
          <div class="field"><label for="user-role">平台角色</label><select id="user-role" v-model="form.role" required><option v-for="option in roleOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select><small>角色用于标识平台职责，不会自动授予任何项目权限。</small></div>
          <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
        </form>
        <template #actions><button class="button secondary" type="button" :disabled="saving" @click="requestCloseCreateDialog">取消</button><button class="button primary" type="submit" form="create-user-form" :disabled="saving">{{ saving ? '新增中…' : '确认新增' }}</button></template>
    </AppDialog>
    <AppConfirmDialog :open="showDiscardConfirm" title="放弃新增用户？" description="当前填写的用户信息尚未保存，放弃后无法恢复。" confirm-label="放弃修改" danger @cancel="showDiscardConfirm = false" @confirm="discardCreateDialog" />
  </div>
</template>

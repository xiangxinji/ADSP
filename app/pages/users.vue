<script setup lang="ts">
import type { ManagedUserAccount, UserRole } from '#shared/types/asdp'

const { data: users, status, error, refresh } = await useFetch<ManagedUserAccount[]>('/api/users')
const showCreateDialog = ref(false)
const showPasswordDialog = ref(false)
const showDiscardConfirm = ref(false)
const saving = ref(false)
const actionError = ref('')
const form = reactive({ name: '', email: '', role: 'member' as UserRole, password: '', passwordConfirmation: '' })
const passwordForm = reactive({ password: '', passwordConfirmation: '' })
const passwordUser = ref<ManagedUserAccount | null>(null)
const showCreatePassword = ref(false)
const showResetPassword = ref(false)
const discardTarget = ref<'create' | 'password'>('create')
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
  Object.assign(form, { name: '', email: '', role: 'member', password: '', passwordConfirmation: '' })
  showCreatePassword.value = false
  actionError.value = ''
  initialForm.value = JSON.stringify(form)
  showCreateDialog.value = true
}

const closeCreateDialog = () => {
  showCreateDialog.value = false
  actionError.value = ''
}

const openPasswordDialog = (user: ManagedUserAccount) => {
  passwordUser.value = user
  Object.assign(passwordForm, { password: '', passwordConfirmation: '' })
  showResetPassword.value = false
  actionError.value = ''
  showPasswordDialog.value = true
}

const closePasswordDialog = () => {
  showPasswordDialog.value = false
  passwordUser.value = null
  actionError.value = ''
}

const requestCloseCreateDialog = () => {
  if (saving.value) return
  if (JSON.stringify(form) !== initialForm.value) {
    discardTarget.value = 'create'
    showDiscardConfirm.value = true
    return
  }
  closeCreateDialog()
}

const requestClosePasswordDialog = () => {
  if (saving.value) return
  if (passwordForm.password || passwordForm.passwordConfirmation) {
    discardTarget.value = 'password'
    showDiscardConfirm.value = true
    return
  }
  closePasswordDialog()
}

const discardDialog = () => {
  showDiscardConfirm.value = false
  if (discardTarget.value === 'password') closePasswordDialog()
  else closeCreateDialog()
}

const createUser = async () => {
  if (form.password !== form.passwordConfirmation) {
    actionError.value = '两次输入的密码不一致'
    return
  }
  saving.value = true
  actionError.value = ''
  try {
    const user = await $fetch<ManagedUserAccount>('/api/users', {
      method: 'POST',
      body: { name: form.name, email: form.email, role: form.role, password: form.password },
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

const updatePassword = async () => {
  if (!passwordUser.value) return
  if (passwordForm.password !== passwordForm.passwordConfirmation) {
    actionError.value = '两次输入的密码不一致'
    return
  }
  saving.value = true
  actionError.value = ''
  try {
    const user = await $fetch<ManagedUserAccount>(`/api/users/${passwordUser.value.id}/password`, {
      method: 'PUT',
      body: { password: passwordForm.password },
    })
    await refresh()
    closePasswordDialog()
    success(`用户“${user.name}”的密码已更新`)
  } catch (requestError: any) {
    actionError.value = requestError?.data?.statusMessage || requestError?.message || '更新密码失败'
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
        <AppButton icon="add" @click="openCreateDialog">新增用户</AppButton>
      </section>

      <AppAsyncState v-if="status === 'pending' || error" :pending="status === 'pending'" :error-message="error?.statusMessage" @retry="refresh" />
      <section v-else-if="users?.length" class="panel user-list" aria-label="用户列表">
        <div class="user-list-heading">
          <div><strong>全部用户</strong><span>共 {{ users.length }} 位</span></div>
          <span>{{ users.filter(user => user.role === 'administrator').length }} 位管理员</span>
        </div>
        <div class="user-table-heading" aria-hidden="true"><span>用户</span><span>平台角色</span><span>密码</span></div>
        <article v-for="user in users" :key="user.id" class="user-row">
          <div class="user-identity">
            <span class="user-avatar">{{ user.name.slice(0, 1).toUpperCase() }}</span>
            <span><strong>{{ user.name }}</strong><small>{{ user.email }}</small><time :datetime="user.createdAt">新增于 {{ formatDate(user.createdAt) }}</time></span>
          </div>
          <span class="user-role" :data-role="user.role">{{ roleLabel(user.role) }}</span>
          <div class="user-password"><span>{{ user.hasPassword ? '已设置' : '未设置' }}</span><AppButton variant="text" @click="openPasswordDialog(user)">{{ user.hasPassword ? '重设' : '设置' }}</AppButton></div>
        </article>
      </section>
      <div v-else class="panel empty-state"><strong>还没有用户</strong><span>新增第一位平台用户，建立 ForgePilot 的全局身份目录。</span><AppButton icon="add" @click="openCreateDialog">新增用户</AppButton></div>
    </main>

    <AppDialog :open="showCreateDialog" title="新增用户" overline="NEW USER" :busy="saving" @request-close="requestCloseCreateDialog">
        <form id="create-user-form" @submit.prevent="createUser">
          <p class="dialog-intro">创建全局平台身份。项目成员关系将在项目授权中单独配置。</p>
          <AppFormField field-id="user-name" label="姓名"><AppInput id="user-name" v-model="form.name" required autofocus placeholder="例如：陈嘉" /></AppFormField>
          <AppFormField field-id="user-email" label="邮箱"><AppInput id="user-email" v-model="form.email" required type="email" autocomplete="email" placeholder="name@example.com" /></AppFormField>
          <AppFormField field-id="user-password" label="密码" hint="密码需为 8–128 个字符，系统仅保存不可逆哈希。"><div class="secret-input"><AppInput id="user-password" v-model="form.password" required minlength="8" maxlength="128" :type="showCreatePassword ? 'text' : 'password'" autocomplete="new-password" placeholder="输入初始密码" /><AppButton variant="plain" :icon="showCreatePassword ? 'eye-off' : 'eye'" :icon-size="14" @click="showCreatePassword = !showCreatePassword">{{ showCreatePassword ? '隐藏' : '显示' }}</AppButton></div></AppFormField>
          <AppFormField field-id="user-password-confirmation" label="确认密码"><AppInput id="user-password-confirmation" v-model="form.passwordConfirmation" required minlength="8" maxlength="128" :type="showCreatePassword ? 'text' : 'password'" autocomplete="new-password" placeholder="再次输入密码" /></AppFormField>
          <AppFormField field-id="user-role" label="平台角色" hint="角色用于标识平台职责，不会自动授予任何项目权限。"><AppSelect id="user-role" v-model="form.role" required><option v-for="option in roleOptions" :key="option.value" :value="option.value">{{ option.label }}</option></AppSelect></AppFormField>
          <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
        </form>
        <template #actions><AppButton variant="secondary" :disabled="saving" @click="requestCloseCreateDialog">取消</AppButton><AppButton type="submit" form="create-user-form" icon="add" :busy="saving" busy-label="新增中…">确认新增</AppButton></template>
    </AppDialog>

    <AppDialog :open="showPasswordDialog" :title="passwordUser?.hasPassword ? '重设密码' : '设置密码'" overline="USER PASSWORD" :busy="saving" @request-close="requestClosePasswordDialog">
      <form id="update-password-form" @submit.prevent="updatePassword">
        <p class="dialog-intro">为用户“{{ passwordUser?.name }}”设置新密码。保存后，旧密码将立即失效。</p>
        <AppFormField field-id="reset-password" label="新密码" hint="密码需为 8–128 个字符，系统仅保存不可逆哈希。"><div class="secret-input"><AppInput id="reset-password" v-model="passwordForm.password" required autofocus minlength="8" maxlength="128" :type="showResetPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="输入新密码" /><AppButton variant="plain" :icon="showResetPassword ? 'eye-off' : 'eye'" :icon-size="14" @click="showResetPassword = !showResetPassword">{{ showResetPassword ? '隐藏' : '显示' }}</AppButton></div></AppFormField>
        <AppFormField field-id="reset-password-confirmation" label="确认新密码"><AppInput id="reset-password-confirmation" v-model="passwordForm.passwordConfirmation" required minlength="8" maxlength="128" :type="showResetPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="再次输入新密码" /></AppFormField>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
      </form>
      <template #actions><AppButton variant="secondary" :disabled="saving" @click="requestClosePasswordDialog">取消</AppButton><AppButton type="submit" form="update-password-form" icon="save" :busy="saving" busy-label="保存中…">保存密码</AppButton></template>
    </AppDialog>

    <AppConfirmDialog :open="showDiscardConfirm" :title="discardTarget === 'password' ? '放弃密码修改？' : '放弃新增用户？'" :description="discardTarget === 'password' ? '当前填写的新密码尚未保存。' : '当前填写的用户信息尚未保存，放弃后无法恢复。'" confirm-label="放弃修改" danger @cancel="showDiscardConfirm = false" @confirm="discardDialog" />
  </div>
</template>

<style scoped>
.user-identity time {
  display: block;
  margin-top: 2px;
}

.user-password {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-password > span {
  color: var(--muted);
  font-size: 9px;
}

@media (max-width: 760px) {
  .user-password {
    grid-column: 2;
    justify-content: flex-end;
  }
}
</style>

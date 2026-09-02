<script setup lang="ts">
import type { ManagedUserAccount, UserRole } from '#shared/types/asdp'

const emit = defineEmits<{ saved: [] }>()
const isOpen = ref(false)
const saving = ref(false)
const actionError = ref('')
const showPassword = ref(false)
const showDiscardConfirm = ref(false)
const snapshot = ref('')
const form = reactive({ name: '', email: '', role: 'member' as UserRole, password: '', passwordConfirmation: '' })
const { success } = useAppToast()
const roleOptions: { value: UserRole, label: string }[] = [
  { value: 'administrator', label: '平台管理员' },
  { value: 'member', label: '普通成员' },
]

const open = () => {
  Object.assign(form, { name: '', email: '', role: 'member', password: '', passwordConfirmation: '' })
  showPassword.value = false
  actionError.value = ''
  snapshot.value = JSON.stringify(form)
  isOpen.value = true
}

const close = () => {
  isOpen.value = false
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
    emit('saved')
    close()
    success(`用户“${user.name}”已新增`)
  } catch (error: any) {
    actionError.value = error?.data?.statusMessage || error?.message || '新增用户失败'
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <AppDialog :open="isOpen" title="新增用户" overline="NEW USER" :busy="saving" @request-close="requestClose">
    <form id="create-user-form" @submit.prevent="save">
      <p class="dialog-intro">创建全局平台身份。项目成员关系将在项目授权中单独配置。</p>
      <AppFormField field-id="user-name" label="姓名"><AppInput id="user-name" v-model="form.name" required autofocus placeholder="例如：陈嘉" /></AppFormField>
      <AppFormField field-id="user-email" label="邮箱"><AppInput id="user-email" v-model="form.email" required type="email" autocomplete="email" placeholder="name@example.com" /></AppFormField>
      <AppFormField field-id="user-password" label="密码" hint="密码需为 8–128 个字符，系统仅保存不可逆哈希。">
        <div class="secret-input">
          <AppInput id="user-password" v-model="form.password" required minlength="8" maxlength="128" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="输入初始密码" />
          <AppButton variant="plain" :icon="showPassword ? 'eye-off' : 'eye'" @click="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</AppButton>
        </div>
      </AppFormField>
      <AppFormField field-id="user-password-confirmation" label="确认密码"><AppInput id="user-password-confirmation" v-model="form.passwordConfirmation" required minlength="8" maxlength="128" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="再次输入密码" /></AppFormField>
      <AppFormField field-id="user-role" label="平台角色" hint="角色用于标识平台职责，不会自动授予任何项目权限。"><AppSelect id="user-role" v-model="form.role" required><option v-for="option in roleOptions" :key="option.value" :value="option.value">{{ option.label }}</option></AppSelect></AppFormField>
      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    </form>
    <template #actions>
      <AppButton variant="secondary" :disabled="saving" @click="requestClose">取消</AppButton>
      <AppButton type="submit" form="create-user-form" icon="add" :busy="saving" busy-label="新增中…">确认新增</AppButton>
    </template>
  </AppDialog>
  <AppConfirmDialog :open="showDiscardConfirm" title="放弃新增用户？" description="当前填写的用户信息尚未保存，放弃后无法恢复。" confirm-label="放弃修改" danger @cancel="showDiscardConfirm = false" @confirm="showDiscardConfirm = false; close()" />
</template>

<script setup lang="ts">
import type { ManagedUserAccount } from '#shared/types/asdp'

const emit = defineEmits<{ saved: [] }>()
const isOpen = ref(false)
const user = ref<ManagedUserAccount | null>(null)
const saving = ref(false)
const actionError = ref('')
const showPassword = ref(false)
const showDiscardConfirm = ref(false)
const form = reactive({ password: '', passwordConfirmation: '' })
const { success } = useAppToast()

const open = (selectedUser: ManagedUserAccount) => {
  user.value = selectedUser
  Object.assign(form, { password: '', passwordConfirmation: '' })
  showPassword.value = false
  actionError.value = ''
  isOpen.value = true
}

const close = () => {
  isOpen.value = false
  user.value = null
  actionError.value = ''
}

const requestClose = () => {
  if (saving.value) return
  if (form.password || form.passwordConfirmation) {
    showDiscardConfirm.value = true
    return
  }
  close()
}

const save = async () => {
  if (!user.value) return
  if (form.password !== form.passwordConfirmation) {
    actionError.value = '两次输入的密码不一致'
    return
  }
  saving.value = true
  actionError.value = ''
  try {
    const updatedUser = await $fetch<ManagedUserAccount>(`/api/users/${user.value.id}/password`, { method: 'PUT', body: { password: form.password } })
    emit('saved')
    close()
    success(`用户“${updatedUser.name}”的密码已更新`)
  } catch (error: any) {
    actionError.value = error?.data?.statusMessage || error?.message || '更新密码失败'
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <AppDialog :open="isOpen" :title="user?.hasPassword ? '重设密码' : '设置密码'" overline="USER PASSWORD" :busy="saving" @request-close="requestClose">
    <form id="update-password-form" @submit.prevent="save">
      <p class="dialog-intro">为用户“{{ user?.name }}”设置新密码。保存后，旧密码将立即失效。</p>
      <AppFormField field-id="reset-password" label="新密码" hint="密码需为 8–128 个字符，系统仅保存不可逆哈希。">
        <div class="secret-input">
          <AppInput id="reset-password" v-model="form.password" required autofocus minlength="8" maxlength="128" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="输入新密码" />
          <AppButton variant="plain" :icon="showPassword ? 'eye-off' : 'eye'" @click="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</AppButton>
        </div>
      </AppFormField>
      <AppFormField field-id="reset-password-confirmation" label="确认新密码">
        <AppInput id="reset-password-confirmation" v-model="form.passwordConfirmation" required minlength="8" maxlength="128" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="再次输入新密码" />
      </AppFormField>
      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    </form>
    <template #actions>
      <AppButton variant="secondary" :disabled="saving" @click="requestClose">取消</AppButton>
      <AppButton type="submit" form="update-password-form" icon="save" :busy="saving" busy-label="保存中…">保存密码</AppButton>
    </template>
  </AppDialog>
  <AppConfirmDialog :open="showDiscardConfirm" title="放弃密码修改？" description="当前填写的新密码尚未保存。" confirm-label="放弃修改" danger @cancel="showDiscardConfirm = false" @confirm="showDiscardConfirm = false; close()" />
</template>

<script setup lang="ts">
import type { EnvironmentAccount, EnvironmentAsset, EnvironmentType } from '#shared/types/asdp'

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ saved: [] }>()
const isOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const actionError = ref('')
const showDiscardConfirm = ref(false)
const snapshot = ref('')
const { success } = useAppToast()
const form = reactive({
  address: '',
  note: '',
  type: 'development' as EnvironmentType,
  accounts: [] as EnvironmentAccount[],
})
const typeOptions: { value: EnvironmentType, label: string }[] = [
  { value: 'development', label: '开发环境' },
  { value: 'testing', label: '测试环境' },
  { value: 'production', label: '生产环境' },
]
const errorMessage = (error: any) => error?.data?.statusMessage || error?.message || '操作失败'

const open = (environment?: EnvironmentAsset) => {
  editingId.value = environment?.id || null
  Object.assign(form, environment ? {
    address: environment.address,
    note: environment.note,
    type: environment.type,
    accounts: environment.accounts.map(account => ({ ...account })),
  } : { address: '', note: '', type: 'development', accounts: [] })
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
    await $fetch(editingId.value ? `/api/environments/${editingId.value}` : `/api/projects/${props.projectId}/environments`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: { ...form, accounts: form.accounts.map(account => ({ account: account.account.trim(), password: account.password })) },
    })
    emit('saved')
    close()
    success('项目环境已保存')
  } catch (error) {
    actionError.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <AppDialog :open="isOpen" :title="editingId ? '编辑环境' : '添加环境'" overline="ENVIRONMENT ASSET" :busy="saving" @request-close="requestClose">
    <form id="environment-form" @submit.prevent="save">
      <p class="dialog-intro">登记可访问的环境地址，并可选择添加自助使用的测试账号。账号和密码会直接展示，不做脱敏。</p>
      <AppFormField field-id="environment-type" label="环境类型">
        <AppSelect id="environment-type" v-model="form.type" required><option v-for="option in typeOptions" :key="option.value" :value="option.value">{{ option.label }}</option></AppSelect>
      </AppFormField>
      <AppFormField field-id="environment-address" label="环境地址" hint="仅支持 HTTP 或 HTTPS 地址，地址中不能包含账号密码。">
        <AppInput id="environment-address" v-model="form.address" required autofocus type="url" placeholder="https://dev.example.com" />
      </AppFormField>
      <AppFormField field-id="environment-note" label="备注" hint="可填写环境用途、访问限制或其他说明。">
        <AppTextarea id="environment-note" v-model="form.note" maxlength="500" placeholder="例如：供测试团队进行验收验证" />
      </AppFormField>
      <div class="field">
        <span class="field-label">关联账号（可选）</span>
        <div class="account-list">
          <div v-for="(_, index) in form.accounts" :key="index" class="account-row">
            <AppInput v-model="form.accounts[index].account" required maxlength="100" :aria-label="`账号 ${index + 1}`" :placeholder="`账号 ${index + 1}`" />
            <AppInput v-model="form.accounts[index].password" maxlength="500" type="text" autocomplete="off" :aria-label="`密码 ${index + 1}`" :placeholder="`密码 ${index + 1}（可选）`" />
            <AppButton variant="text-danger" icon="delete" @click="form.accounts.splice(index, 1)">移除</AppButton>
          </div>
          <AppButton variant="text" class="add-account" icon="add" :disabled="form.accounts.length >= 20" @click="form.accounts.push({ account: '', password: '' })">添加账号</AppButton>
        </div>
        <small>可以不添加账号；最多添加 20 个，密码可留空且会按原文保存并明文展示。</small>
      </div>
      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    </form>
    <template #actions>
      <AppButton variant="secondary" :disabled="saving" @click="requestClose">取消</AppButton>
      <AppButton type="submit" form="environment-form" icon="save" :busy="saving" busy-label="保存中…">保存环境</AppButton>
    </template>
  </AppDialog>
  <AppConfirmDialog :open="showDiscardConfirm" title="放弃未保存的修改？" description="当前弹框中的修改尚未保存，放弃后无法恢复。" confirm-label="放弃修改" danger @cancel="showDiscardConfirm = false" @confirm="showDiscardConfirm = false; close()" />
</template>

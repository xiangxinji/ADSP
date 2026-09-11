<script setup lang="ts">
import type { AiInterfaceAsset } from '#shared/types/ai-interfaces'

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ saved: [] }>()
const isOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const actionError = ref('')
const showDiscardConfirm = ref(false)
const initialMetadata = ref('')
const { success } = useAppToast()
const form = reactive({ provider: 'DeepSeek', name: '', apiKey: '' })
const providers = ['DeepSeek', 'OpenAI', 'Anthropic', 'Google Gemini', '通义千问', '豆包', '智谱']
const metadata = () => JSON.stringify({ provider: form.provider, name: form.name })

const open = (asset?: AiInterfaceAsset) => {
  editingId.value = asset?.id || null
  Object.assign(form, { provider: asset?.provider || 'DeepSeek', name: asset?.name || '', apiKey: '' })
  initialMetadata.value = metadata()
  actionError.value = ''
  showDiscardConfirm.value = false
  isOpen.value = true
}

const close = () => {
  isOpen.value = false
  editingId.value = null
  form.apiKey = ''
  actionError.value = ''
}

const requestClose = () => {
  if (saving.value) return
  if (metadata() !== initialMetadata.value || form.apiKey) {
    showDiscardConfirm.value = true
    return
  }
  close()
}

const save = async () => {
  if (saving.value) return
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(editingId.value ? `/api/ai-interfaces/${editingId.value}` : `/api/projects/${props.projectId}/ai-interfaces`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: {
        provider: form.provider.trim(),
        name: form.name.trim(),
        ...(!editingId.value || form.apiKey !== '' ? { apiKey: form.apiKey } : {}),
      },
    })
    emit('saved')
    close()
    success('AI 接口已保存')
  } catch (error: any) {
    actionError.value = error?.statusCode === 409 || error?.response?.status === 409
      ? '当前项目已存在同名 AI 接口，请使用其他名称。'
      : '保存失败，请检查平台、名称和 API Key 是否填写正确后重试。'
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <AppDialog :open="isOpen" :title="editingId ? '编辑 AI 接口' : '添加 AI 接口'" overline="AI INTERFACE ASSET" :busy="saving" @request-close="requestClose">
    <form id="ai-interface-form" @submit.prevent="save">
      <p class="dialog-intro">登记不同 AI 平台的接口配置。API Key 加密保存，不会在列表或编辑时回显。</p>
      <AppFormField field-id="ai-interface-provider" label="AI 平台" hint="可选择常用平台，也可直接输入其他平台名称。">
        <AppInput id="ai-interface-provider" v-model="form.provider" list="ai-interface-providers" required maxlength="100" placeholder="例如：DeepSeek" />
        <datalist id="ai-interface-providers">
          <option v-for="provider in providers" :key="provider" :value="provider" />
        </datalist>
      </AppFormField>
      <AppFormField field-id="ai-interface-name" label="接口名称" hint="用于在当前项目中识别接口，同一项目内不能重名。">
        <AppInput id="ai-interface-name" v-model="form.name" required maxlength="100" autofocus placeholder="例如：DeepSeek 需求分析" />
      </AppFormField>
      <AppFormField field-id="ai-interface-key" label="API Key" :hint="editingId ? '留空保留原密钥；填写新值后替换。' : '仅用于此项目的 AI 接口，请勿填写生产部署凭据。'">
        <AppInput id="ai-interface-key" v-model="form.apiKey" type="password" :required="!editingId" maxlength="4096" autocomplete="new-password" :spellcheck="false" :placeholder="editingId ? '已配置，留空不修改' : '输入平台提供的 API Key'" />
      </AppFormField>
      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    </form>
    <template #actions>
      <AppButton variant="secondary" :disabled="saving" @click="requestClose">取消</AppButton>
      <AppButton type="submit" form="ai-interface-form" icon="save" :busy="saving" busy-label="保存中…">保存接口</AppButton>
    </template>
  </AppDialog>
  <AppConfirmDialog :open="showDiscardConfirm" title="放弃未保存的修改？" description="当前接口配置尚未保存，放弃后无法恢复。" confirm-label="放弃修改" danger @cancel="showDiscardConfirm = false" @confirm="showDiscardConfirm = false; close()" />
</template>

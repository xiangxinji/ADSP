<script setup lang="ts">
import type { WorkflowDefinition } from '#shared/types/asdp'

const props = defineProps<{ projectId: string }>()
const isOpen = ref(false)
const saving = ref(false)
const actionError = ref('')
const showDiscardConfirm = ref(false)
const snapshot = ref('')
const router = useRouter()
const form = reactive({ name: '', note: '' })

const open = () => {
  Object.assign(form, { name: '', note: '' })
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

const create = async () => {
  saving.value = true
  actionError.value = ''
  try {
    const workflow = await $fetch<WorkflowDefinition>(`/api/projects/${props.projectId}/workflows`, {
      method: 'POST',
      body: form,
    })
    close()
    await router.push(`/projects/${props.projectId}/workflows/${workflow.id}`)
  } catch (error: any) {
    actionError.value = error?.data?.statusMessage || error?.message || '创建工作流失败'
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <AppDialog :open="isOpen" title="新建工作流" overline="WORKFLOW" icon="workflow" :busy="saving" @request-close="requestClose">
    <form id="workflow-create-form" @submit.prevent="create">
      <AppFormField field-id="workflow-name" label="名称" hint="创建后将直接进入画板配置触发器和资产操作。">
        <AppInput id="workflow-name" v-model="form.name" required maxlength="100" autofocus placeholder="例如：需求持续交付" />
      </AppFormField>
      <AppFormField field-id="workflow-note" label="备注">
        <AppTextarea id="workflow-note" v-model="form.note" maxlength="500" rows="3" placeholder="说明这个工作流的用途和适用范围" />
      </AppFormField>
      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    </form>
    <template #actions>
      <AppButton variant="secondary" :disabled="saving" @click="requestClose">取消</AppButton>
      <AppButton type="submit" form="workflow-create-form" icon="workflow" :busy="saving" busy-label="创建中…">创建并进入画板</AppButton>
    </template>
  </AppDialog>
  <AppConfirmDialog :open="showDiscardConfirm" title="放弃未保存的信息？" description="工作流名称和备注尚未创建，放弃后需要重新填写。" confirm-label="放弃" danger @cancel="showDiscardConfirm = false" @confirm="showDiscardConfirm = false; close()" />
</template>

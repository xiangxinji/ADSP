<script setup lang="ts">
import type { ProjectWorkspace, RequirementStatus } from '#shared/types/asdp'

type Confirmation = {
  title: string
  description: string
  confirmLabel: string
  action: () => Promise<void> | void
}

const props = defineProps<{
  workspace: ProjectWorkspace
  projectId: string
}>()

const emit = defineEmits<{ saved: [] }>()
const isOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const actionError = ref('')
const snapshot = ref('')
const confirmation = shallowRef<Confirmation | null>(null)
const confirmationBusy = ref(false)
const { success } = useAppToast()
const form = reactive({
  key: '',
  name: '',
  color: '#2563eb',
  sortOrder: 10,
  isInitial: false,
  isTerminal: false,
})

const errorMessage = (error: any) => error?.data?.statusMessage || error?.message || '操作失败'
const captureSnapshot = () => { snapshot.value = JSON.stringify({ editingId: editingId.value, ...form }) }

const reset = (sortOrder?: number) => {
  editingId.value = null
  Object.assign(form, {
    key: '',
    name: '',
    color: '#2563eb',
    sortOrder: sortOrder ?? (props.workspace.requirementStatuses.at(-1)?.sortOrder || 0) + 10,
    isInitial: false,
    isTerminal: false,
  })
  actionError.value = ''
  captureSnapshot()
}

const open = () => {
  reset()
  isOpen.value = true
}

const edit = (status: RequirementStatus) => {
  editingId.value = status.id
  Object.assign(form, {
    key: status.key,
    name: status.name,
    color: status.color,
    sortOrder: status.sortOrder,
    isInitial: status.isInitial,
    isTerminal: status.isTerminal,
  })
  actionError.value = ''
  captureSnapshot()
}

const close = () => {
  isOpen.value = false
  editingId.value = null
  actionError.value = ''
}

const requestClose = () => {
  if (saving.value) return
  if (JSON.stringify({ editingId: editingId.value, ...form }) !== snapshot.value) {
    confirmation.value = {
      title: '放弃未保存的修改？',
      description: '当前弹框中的修改尚未保存，放弃后无法恢复。',
      confirmLabel: '放弃修改',
      action: close,
    }
    return
  }
  close()
}

const runConfirmation = async () => {
  if (!confirmation.value) return
  confirmationBusy.value = true
  try {
    await confirmation.value.action()
    confirmation.value = null
  } finally {
    confirmationBusy.value = false
  }
}

const save = async () => {
  const nextSortOrder = editingId.value ? undefined : form.sortOrder + 10
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(editingId.value ? `/api/requirement-statuses/${editingId.value}` : `/api/projects/${props.projectId}/requirement-statuses`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: form,
    })
    emit('saved')
    reset(nextSortOrder)
    success('需求状态已保存')
  } catch (error) {
    actionError.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}

const remove = (status: RequirementStatus) => {
  confirmation.value = {
    title: `删除状态“${status.name}”？`,
    description: '删除后无法恢复。正在被需求引用的状态不会被系统删除。',
    confirmLabel: '删除状态',
    action: async () => {
      actionError.value = ''
      try {
        await $fetch(`/api/requirement-statuses/${status.id}`, { method: 'DELETE' })
        if (editingId.value === status.id) reset()
        emit('saved')
        success(`状态“${status.name}”已删除`)
      } catch (error) {
        actionError.value = errorMessage(error)
      }
    },
  }
}

defineExpose({ open })
</script>

<template>
  <AppDialog :open="isOpen" title="需求状态管理" overline="REQUIREMENT STATUS" class="large status-dialog" :busy="saving" @request-close="requestClose">
    <p class="dialog-intro">状态是当前项目的独立数据。需求引用状态记录，正在使用的状态不能直接删除。</p>
    <div class="status-manager">
      <div class="status-records">
        <article v-for="status in workspace.requirementStatuses" :key="status.id" class="status-record" :class="{ selected: editingId === status.id }">
          <span class="status-color" :style="{ backgroundColor: status.color }" />
          <div><strong>{{ status.name }}</strong><small>{{ status.key }} · 排序 {{ status.sortOrder }} · {{ status.requirementCount }} 条需求</small><div class="status-flags"><span v-if="status.isInitial">初始状态</span><span v-if="status.isTerminal">终态</span></div></div>
          <div class="status-actions"><AppButton variant="text" icon="edit" @click="edit(status)">编辑</AppButton><AppButton variant="text-danger" icon="delete" @click="remove(status)">删除</AppButton></div>
        </article>
      </div>
      <form class="status-editor" @submit.prevent="save">
        <div class="status-editor-heading"><h3>{{ editingId ? '编辑状态' : '新增状态' }}</h3><AppButton v-if="editingId" variant="text" icon="add" @click="reset()">新增状态</AppButton></div>
        <div class="form-grid two">
          <AppFormField field-id="status-name" label="显示名称"><AppInput id="status-name" v-model="form.name" required autofocus placeholder="例如：评审中" /></AppFormField>
          <AppFormField field-id="status-key" label="唯一标识"><AppInput id="status-key" v-model="form.key" required pattern="[a-z][a-z0-9_]*" placeholder="reviewing" /></AppFormField>
          <AppFormField field-id="status-color" label="颜色"><div class="color-input"><AppInput v-model="form.color" aria-label="选择状态颜色" type="color" /><AppInput id="status-color" v-model="form.color" required pattern="#[0-9a-fA-F]{6}" /></div></AppFormField>
          <AppFormField field-id="status-sort" label="排序"><AppInput id="status-sort" v-model.number="form.sortOrder" required type="number" min="0" step="1" /></AppFormField>
        </div>
        <label class="toggle-field"><AppCheckbox v-model="form.isInitial" :disabled="Boolean(editingId && form.isInitial)" /><span><strong>初始状态</strong><small>新需求默认使用该状态</small></span></label>
        <label class="toggle-field"><AppCheckbox v-model="form.isTerminal" /><span><strong>终态</strong><small>表示需求生命周期已经结束</small></span></label>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
        <div class="dialog-actions"><AppButton type="submit" :icon="editingId ? 'save' : 'add'" :busy="saving" busy-label="保存中…">{{ editingId ? '保存修改' : '新增状态' }}</AppButton></div>
      </form>
    </div>
  </AppDialog>
  <AppConfirmDialog :open="Boolean(confirmation)" :title="confirmation?.title || ''" :description="confirmation?.description || ''" :confirm-label="confirmation?.confirmLabel || '确认'" :busy="confirmationBusy" danger @cancel="confirmation = null" @confirm="runConfirmation" />
</template>

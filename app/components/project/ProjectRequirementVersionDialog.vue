<script setup lang="ts">
import type { ProjectWorkspace } from '#shared/types/asdp'

type RequirementVersion = ProjectWorkspace['requirementVersions'][number]
type Confirmation = { title: string, description: string, confirmLabel: string, action: () => Promise<void> | void }

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
const form = reactive({ major: 1 })
const { success } = useAppToast()

const errorMessage = (error: any) => error?.data?.statusMessage || error?.message || '操作失败'
const captureSnapshot = () => { snapshot.value = JSON.stringify({ editingId: editingId.value, ...form }) }

const reset = (major?: number) => {
  editingId.value = null
  form.major = major ?? (props.workspace.requirementVersions[0]?.major ?? 0) + 1
  actionError.value = ''
  captureSnapshot()
}

const open = () => {
  reset()
  isOpen.value = true
}

const edit = (version: RequirementVersion) => {
  editingId.value = version.id
  form.major = version.major
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
  const nextMajor = editingId.value ? undefined : form.major + 1
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(editingId.value ? `/api/requirement-versions/${editingId.value}` : `/api/projects/${props.projectId}/requirement-versions`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: form,
    })
    emit('saved')
    reset(nextMajor)
    success('需求版本已保存')
  } catch (error) {
    actionError.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}

const remove = (version: RequirementVersion) => {
  confirmation.value = {
    title: `删除版本“${version.name}”？`,
    description: '删除后无法恢复。正在被需求引用的版本不会被系统删除。',
    confirmLabel: '删除版本',
    action: async () => {
      actionError.value = ''
      try {
        await $fetch(`/api/requirement-versions/${version.id}`, { method: 'DELETE' })
        if (editingId.value === version.id) reset()
        emit('saved')
        success(`版本“${version.name}”已删除`)
      } catch (error) {
        actionError.value = errorMessage(error)
      }
    },
  }
}

defineExpose({ open })
</script>

<template>
  <AppDialog :open="isOpen" title="需求版本管理" overline="REQUIREMENT VERSION" class="large status-dialog" :busy="saving" @request-close="requestClose">
    <p class="dialog-intro">只维护大版本号，系统固定展示为 v${大版本号}.x；数值最大的版本自动标记为 latest。</p>
    <div class="status-manager">
      <div class="status-records">
        <article v-for="version in workspace.requirementVersions" :key="version.id" class="status-record version-record" :class="{ selected: editingId === version.id }">
          <div><strong>{{ version.name }} <em v-if="version.isLatest" class="latest-label">latest</em></strong><small>大版本号 {{ version.major }} · {{ version.requirementCount }} 条需求</small></div>
          <div class="status-actions"><AppButton variant="text" icon="edit" @click="edit(version)">编辑</AppButton><AppButton variant="text-danger" icon="delete" @click="remove(version)">删除</AppButton></div>
        </article>
        <p v-if="!workspace.requirementVersions.length" class="picker-empty">还没有版本，请先添加一个大版本。</p>
      </div>
      <form class="status-editor" @submit.prevent="save">
        <div class="status-editor-heading"><h3>{{ editingId ? '编辑版本' : '新增版本' }}</h3><AppButton v-if="editingId" variant="text" icon="add" @click="reset()">新增版本</AppButton></div>
        <AppFormField field-id="version-major" label="大版本号"><AppInput id="version-major" v-model.number="form.major" required autofocus type="number" min="0" step="1" placeholder="例如：3" /><template #hint>将显示为 v{{ form.major }}.x</template></AppFormField>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
        <div class="dialog-actions"><AppButton type="submit" :icon="editingId ? 'save' : 'add'" :busy="saving" busy-label="保存中…">{{ editingId ? '保存修改' : '新增版本' }}</AppButton></div>
      </form>
    </div>
  </AppDialog>
  <AppConfirmDialog :open="Boolean(confirmation)" :title="confirmation?.title || ''" :description="confirmation?.description || ''" :confirm-label="confirmation?.confirmLabel || '确认'" :busy="confirmationBusy" danger @cancel="confirmation = null" @confirm="runConfirmation" />
</template>

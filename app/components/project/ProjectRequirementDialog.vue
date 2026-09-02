<script setup lang="ts">
import type { ProjectWorkspace, RepositoryProvider, Requirement, RequirementPriority } from '#shared/types/asdp'

const props = defineProps<{
  workspace: ProjectWorkspace
  projectId: string
}>()

const emit = defineEmits<{ saved: [] }>()
const isOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const actionError = ref('')
const showDiscardConfirm = ref(false)
const snapshot = ref('')
const { success } = useAppToast()
const form = reactive({
  title: '',
  description: '',
  acceptanceCriteria: '',
  statusId: '',
  priority: 'medium' as RequirementPriority,
  versionIds: [] as string[],
  repositoryIds: [] as string[],
  memberIds: [] as string[],
})

const priorityOptions: { value: RequirementPriority, label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
]

const repositoryProviderLabel = (value: RepositoryProvider) => ({ gitlab: 'GitLab', github: 'GitHub' })[value]
const errorMessage = (error: any) => error?.data?.statusMessage || error?.message || '操作失败'

const open = (requirement?: Requirement) => {
  editingId.value = requirement?.id || null
  Object.assign(form, requirement ? {
    title: requirement.title,
    description: requirement.description,
    acceptanceCriteria: requirement.acceptanceCriteria,
    statusId: requirement.statusId,
    priority: requirement.priority,
    versionIds: [...requirement.versionIds],
    repositoryIds: [...requirement.repositoryIds],
    memberIds: [...requirement.memberIds],
  } : {
    title: '',
    description: '',
    acceptanceCriteria: '',
    statusId: props.workspace.requirementStatuses.find(status => status.isInitial)?.id || props.workspace.requirementStatuses[0]?.id || '',
    priority: 'medium',
    versionIds: [],
    repositoryIds: [],
    memberIds: [],
  })
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
    await $fetch(editingId.value ? `/api/requirements/${editingId.value}` : `/api/projects/${props.projectId}/requirements`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: form,
    })
    emit('saved')
    close()
    success('需求已保存')
  } catch (error) {
    actionError.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <AppDialog :open="isOpen" :title="editingId ? '编辑需求' : '新建需求'" overline="REQUIREMENT" class="large" :busy="saving" @request-close="requestClose">
    <form id="requirement-form" @submit.prevent="save">
      <div class="form-grid two">
        <AppFormField class="span-two" field-id="requirement-title" label="标题"><AppInput id="requirement-title" v-model="form.title" required autofocus placeholder="描述要交付的功能" /></AppFormField>
        <AppFormField field-id="requirement-status" label="状态"><AppSelect id="requirement-status" v-model="form.statusId" required><option v-for="status in workspace.requirementStatuses" :key="status.id" :value="status.id">{{ status.name }}</option></AppSelect></AppFormField>
        <AppFormField field-id="requirement-priority" label="优先级"><AppSelect id="requirement-priority" v-model="form.priority"><option v-for="option in priorityOptions" :key="option.value" :value="option.value">{{ option.label }}</option></AppSelect></AppFormField>
        <AppFormField class="span-two" field-id="requirement-description" label="需求说明"><AppTextarea id="requirement-description" v-model="form.description" rows="3" placeholder="说明背景、目标和范围" /></AppFormField>
        <AppFormField class="span-two" field-id="requirement-acceptance" label="验收标准"><AppTextarea id="requirement-acceptance" v-model="form.acceptanceCriteria" rows="3" placeholder="说明怎样才算完成" /></AppFormField>
      </div>
      <div class="reference-picker">
        <div><h3>关联版本</h3><p>可以选择多个大版本</p></div>
        <div v-if="workspace.requirementVersions.length" class="check-list">
          <label v-for="version in workspace.requirementVersions" :key="version.id">
            <AppCheckbox v-model="form.versionIds" :value="version.id" />
            <span><strong>{{ version.name }} <em v-if="version.isLatest" class="latest-label">latest</em></strong><small>{{ version.requirementCount }} 条需求已关联</small></span>
          </label>
        </div>
        <p v-else class="picker-empty">请先在版本管理中添加大版本。</p>
      </div>
      <div class="reference-picker">
        <div><h3>引用代码仓库</h3><p>可以选择多个仓库</p></div>
        <div v-if="workspace.repositories.length" class="check-list">
          <label v-for="repository in workspace.repositories" :key="repository.id">
            <AppCheckbox v-model="form.repositoryIds" :value="repository.id" />
            <span><strong>{{ repository.name }}</strong><small>{{ repositoryProviderLabel(repository.provider) }}<template v-if="repository.note"> · {{ repository.note }}</template></small></span>
          </label>
        </div>
        <p v-else class="picker-empty">请先在资产模块添加代码仓库。</p>
      </div>
      <div class="reference-picker">
        <div><h3>引用项目成员</h3><p>可以选择多位参与者</p></div>
        <div v-if="workspace.members.length" class="check-list">
          <label v-for="member in workspace.members" :key="member.id"><AppCheckbox v-model="form.memberIds" :value="member.id" /><span><strong>{{ member.user.name }}</strong><small>{{ member.role || member.user.email }}</small></span></label>
        </div>
        <p v-else class="picker-empty">请先在资产模块添加成员。</p>
      </div>
      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    </form>
    <template #actions>
      <AppButton variant="secondary" :disabled="saving" @click="requestClose">取消</AppButton>
      <AppButton type="submit" form="requirement-form" icon="save" :busy="saving" busy-label="保存中…">保存需求</AppButton>
    </template>
  </AppDialog>
  <AppConfirmDialog :open="showDiscardConfirm" title="放弃未保存的修改？" description="当前弹框中的修改尚未保存，放弃后无法恢复。" confirm-label="放弃修改" danger @cancel="showDiscardConfirm = false" @confirm="showDiscardConfirm = false; close()" />
</template>

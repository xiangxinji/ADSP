<script setup lang="ts">
import type { GitLabRepository, GitLabRepositoryPage, RepositoryAsset, RepositoryBranchStrategy, RepositoryProvider } from '#shared/types/asdp'

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ saved: [] }>()
const isOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const actionError = ref('')
const showDiscardConfirm = ref(false)
const snapshot = ref('')
const repositories = ref<GitLabRepository[]>([])
const repositorySearch = ref('')
const repositoriesLoading = ref(false)
const repositoryError = ref('')
const { success } = useAppToast()
const form = reactive({
  provider: 'gitlab' as RepositoryProvider,
  branchStrategy: 'multi-version' as RepositoryBranchStrategy,
  externalId: null as string | null,
  name: '',
  note: '',
  url: '',
})

const providerOptions: { value: RepositoryProvider, label: string }[] = [
  { value: 'gitlab', label: 'GitLab' },
  { value: 'github', label: 'GitHub' },
]
const branchStrategyOptions: { value: RepositoryBranchStrategy, label: string, description: string, rules: { branch: string, purpose: string }[] }[] = [
  { value: 'multi-version', label: '多版本分支策略', description: '分支与需求中的版本概念联动，latest 和每个 vN.x 版本分别拥有发布、测试分支。', rules: [{ branch: 'main', purpose: 'latest 发布分支' }, { branch: 'test', purpose: 'latest 测试分支' }, { branch: 'v1.x', purpose: 'v1.x 版本发布分支' }, { branch: 'v1.x-test', purpose: 'v1.x 版本测试分支' }] },
  { value: 'development-production', label: '开发生产策略', description: '仅使用两个长期分支，不与需求版本拆分出独立分支。', rules: [{ branch: 'dev', purpose: '开发分支' }, { branch: 'main', purpose: '生产发布分支' }] },
]

const providerLabel = (value: RepositoryProvider) => providerOptions.find(option => option.value === value)?.label || value
const urlPlaceholder = computed(() => form.provider === 'github' ? 'https://github.com/team/repo.git' : 'https://gitlab.example.com/team/repo.git')
const errorMessage = (error: any) => error?.data?.statusMessage || error?.message || '操作失败'

const loadRepositories = async () => {
  repositoriesLoading.value = true
  repositoryError.value = ''
  try {
    const result = await $fetch<GitLabRepositoryPage>('/api/integrations/gitlab/repositories', { query: { search: repositorySearch.value, perPage: 20 } })
    repositories.value = result.items
  } catch (error) {
    repositoryError.value = errorMessage(error)
  } finally {
    repositoriesLoading.value = false
  }
}

const selectRepository = (repository: GitLabRepository) => {
  Object.assign(form, { provider: 'gitlab', externalId: String(repository.id), name: repository.name, url: repository.webUrl })
}

const open = (repository?: RepositoryAsset) => {
  editingId.value = repository?.id || null
  Object.assign(form, repository ? {
    provider: repository.provider,
    branchStrategy: repository.branchStrategy,
    externalId: repository.externalId,
    name: repository.name,
    note: repository.note,
    url: repository.url,
  } : { provider: 'gitlab', branchStrategy: 'multi-version', externalId: null, name: '', note: '', url: '' })
  repositories.value = []
  repositorySearch.value = ''
  repositoryError.value = ''
  actionError.value = ''
  snapshot.value = JSON.stringify(form)
  isOpen.value = true
  if (!repository) void loadRepositories()
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
    await $fetch(editingId.value ? `/api/repositories/${editingId.value}` : `/api/projects/${props.projectId}/repositories`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: form,
    })
    emit('saved')
    close()
    success('代码仓库已保存')
  } catch (error) {
    actionError.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <AppDialog :open="isOpen" :title="editingId ? '编辑代码仓库' : '添加代码仓库'" overline="REPOSITORY ASSET" class="repository-dialog" :busy="saving" @request-close="requestClose">
    <form id="repository-form" @submit.prevent="save">
      <section v-if="!editingId && form.provider === 'gitlab'" class="gitlab-picker">
        <div class="gitlab-picker-heading">
          <div><strong>从 GitLab 选择</strong><small>使用全局 Token 读取你有权访问的仓库</small></div>
          <AppButton variant="text" icon="settings" to="/settings">全局设置</AppButton>
        </div>
        <div class="gitlab-picker-search">
          <label class="sr-only" for="gitlab-repository-search">搜索 GitLab 仓库</label>
          <AppInput id="gitlab-repository-search" v-model="repositorySearch" placeholder="搜索 GitLab 仓库" @keydown.enter.prevent="loadRepositories" />
          <AppButton variant="secondary" icon="search" :busy="repositoriesLoading" busy-label="读取中…" @click="loadRepositories">查询</AppButton>
        </div>
        <p v-if="repositoryError" class="picker-error" role="alert">{{ repositoryError }}</p>
        <div v-if="repositories.length" class="gitlab-results">
          <AppButton v-for="repository in repositories" :key="repository.id" variant="plain" :class="{ selected: form.externalId === String(repository.id) }" @click="selectRepository(repository)">
            <span><strong>{{ repository.name }}</strong><small>{{ repository.nameWithNamespace }}</small></span><em>{{ repository.defaultBranch }}</em>
          </AppButton>
        </div>
      </section>
      <AppFormField field-id="repository-provider" label="代码托管平台">
        <AppSelect id="repository-provider" v-model="form.provider" required><option v-for="option in providerOptions" :key="option.value" :value="option.value">{{ option.label }}</option></AppSelect>
      </AppFormField>
      <fieldset class="branch-strategy-field">
        <legend>版本分支策略</legend>
        <div class="branch-strategy-options">
          <label v-for="option in branchStrategyOptions" :key="option.value" class="branch-strategy-option">
            <input v-model="form.branchStrategy" type="radio" name="repository-branch-strategy" :value="option.value">
            <span class="branch-strategy-copy">
              <strong>{{ option.label }}</strong><small>{{ option.description }}</small>
              <span class="branch-strategy-rules"><span v-for="rule in option.rules" :key="rule.branch" class="branch-strategy-rule"><code>{{ rule.branch }}</code><span>{{ rule.purpose }}</span></span></span>
            </span>
          </label>
        </div>
      </fieldset>
      <AppFormField field-id="repository-name" label="仓库名称"><AppInput id="repository-name" v-model="form.name" required placeholder="例如：forgepilot-web" /></AppFormField>
      <AppFormField field-id="repository-note" label="备注" hint="可填写仓库用途、维护范围或其他说明。">
        <AppTextarea id="repository-note" v-model="form.note" maxlength="500" placeholder="例如：前端主仓库，负责 ForgePilot 控制台" />
      </AppFormField>
      <AppFormField field-id="repository-url" :label="`${providerLabel(form.provider)} 仓库地址`">
        <AppInput id="repository-url" v-model="form.url" required type="url" :placeholder="urlPlaceholder" @input="form.externalId = null" />
      </AppFormField>
      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    </form>
    <template #actions>
      <AppButton variant="secondary" :disabled="saving" @click="requestClose">取消</AppButton>
      <AppButton type="submit" form="repository-form" icon="save" :busy="saving" busy-label="保存中…">保存仓库</AppButton>
    </template>
  </AppDialog>
  <AppConfirmDialog :open="showDiscardConfirm" title="放弃未保存的修改？" description="当前弹框中的修改尚未保存，放弃后无法恢复。" confirm-label="放弃修改" danger @cancel="showDiscardConfirm = false" @confirm="showDiscardConfirm = false; close()" />
</template>

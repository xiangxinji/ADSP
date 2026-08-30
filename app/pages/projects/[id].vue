<script setup lang="ts">
import type {
  GitLabRepository,
  GitLabRepositoryPage,
  PersonAsset,
  ProjectWorkspace,
  RepositoryAsset,
  RepositoryProvider,
  Requirement,
  RequirementPriority,
  RequirementStatus,
} from '#shared/types/asdp'

const route = useRoute()
const projectId = computed(() => String(route.params.id))
const workspaceUrl = computed(() => `/api/projects/${projectId.value}`)
const { data: workspace, status, error, refresh } = await useFetch<ProjectWorkspace>(workspaceUrl)

const activeTab = ref<'requirements' | 'assets'>('requirements')
const dialog = ref<'requirement' | 'statuses' | 'repository' | 'person' | null>(null)
const editingId = ref<string | null>(null)
const saving = ref(false)
const actionError = ref('')

const requirementForm = reactive({
  title: '',
  description: '',
  acceptanceCriteria: '',
  statusId: '',
  priority: 'medium' as RequirementPriority,
  repositoryIds: [] as string[],
  personIds: [] as string[],
})
const repositoryForm = reactive({ provider: 'gitlab' as RepositoryProvider, externalId: null as string | null, name: '', url: '', defaultBranch: 'main' })
const gitlabRepositories = ref<GitLabRepository[]>([])
const gitlabRepositorySearch = ref('')
const gitlabRepositoriesLoading = ref(false)
const gitlabRepositoryError = ref('')
const personForm = reactive({ name: '', email: '', role: '' })
const requirementStatusForm = reactive({
  key: '',
  name: '',
  color: '#2563eb',
  sortOrder: 10,
  isInitial: false,
  isTerminal: false,
})

const priorityOptions: { value: RequirementPriority, label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
]

const repositoryProviderOptions: { value: RepositoryProvider, label: string }[] = [
  { value: 'gitlab', label: 'GitLab' },
  { value: 'github', label: 'GitHub' },
]

const priorityLabel = (value: RequirementPriority) => priorityOptions.find(option => option.value === value)?.label || value
const repositoryProviderLabel = (value: RepositoryProvider) => repositoryProviderOptions.find(option => option.value === value)?.label || value
const repositoryUrlPlaceholder = computed(() => repositoryForm.provider === 'github'
  ? 'https://github.com/team/repo.git'
  : 'https://gitlab.example.com/team/repo.git')
const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

const openRequirement = (requirement?: Requirement) => {
  editingId.value = requirement?.id || null
  Object.assign(requirementForm, requirement ? {
    title: requirement.title,
    description: requirement.description,
    acceptanceCriteria: requirement.acceptanceCriteria,
    statusId: requirement.statusId,
    priority: requirement.priority,
    repositoryIds: [...requirement.repositoryIds],
    personIds: [...requirement.personIds],
  } : {
    title: '',
    description: '',
    acceptanceCriteria: '',
    statusId: workspace.value?.requirementStatuses.find(status => status.isInitial)?.id || workspace.value?.requirementStatuses[0]?.id || '',
    priority: 'medium',
    repositoryIds: [],
    personIds: [],
  })
  actionError.value = ''
  dialog.value = 'requirement'
}

const resetRequirementStatusForm = () => {
  editingId.value = null
  Object.assign(requirementStatusForm, {
    key: '',
    name: '',
    color: '#2563eb',
    sortOrder: (workspace.value?.requirementStatuses.at(-1)?.sortOrder || 0) + 10,
    isInitial: false,
    isTerminal: false,
  })
  actionError.value = ''
}

const openStatusManager = () => {
  resetRequirementStatusForm()
  dialog.value = 'statuses'
}

const editRequirementStatus = (requirementStatus: RequirementStatus) => {
  editingId.value = requirementStatus.id
  Object.assign(requirementStatusForm, {
    key: requirementStatus.key,
    name: requirementStatus.name,
    color: requirementStatus.color,
    sortOrder: requirementStatus.sortOrder,
    isInitial: requirementStatus.isInitial,
    isTerminal: requirementStatus.isTerminal,
  })
  actionError.value = ''
}

const openRepository = (repository?: RepositoryAsset) => {
  editingId.value = repository?.id || null
  Object.assign(repositoryForm, repository ? {
    provider: repository.provider, externalId: repository.externalId, name: repository.name, url: repository.url, defaultBranch: repository.defaultBranch,
  } : { provider: 'gitlab', externalId: null, name: '', url: '', defaultBranch: 'main' })
  gitlabRepositories.value = []
  gitlabRepositorySearch.value = ''
  gitlabRepositoryError.value = ''
  actionError.value = ''
  dialog.value = 'repository'
  if (!repository) void loadGitLabRepositories()
}

const openPerson = (person?: PersonAsset) => {
  editingId.value = person?.id || null
  Object.assign(personForm, person ? { name: person.name, email: person.email, role: person.role } : { name: '', email: '', role: '' })
  actionError.value = ''
  dialog.value = 'person'
}

const closeDialog = () => {
  dialog.value = null
  editingId.value = null
  actionError.value = ''
}

const errorMessage = (requestError: any) => requestError?.data?.statusMessage || requestError?.message || '操作失败'

const loadGitLabRepositories = async () => {
  gitlabRepositoriesLoading.value = true
  gitlabRepositoryError.value = ''
  try {
    const result = await $fetch<GitLabRepositoryPage>('/api/integrations/gitlab/repositories', {
      query: { search: gitlabRepositorySearch.value, perPage: 20 },
    })
    gitlabRepositories.value = result.items
  } catch (requestError) {
    gitlabRepositoryError.value = errorMessage(requestError)
  } finally {
    gitlabRepositoriesLoading.value = false
  }
}

const selectGitLabRepository = (repository: GitLabRepository) => {
  Object.assign(repositoryForm, {
    provider: 'gitlab',
    externalId: String(repository.id),
    name: repository.name,
    url: repository.webUrl,
    defaultBranch: repository.defaultBranch,
  })
}

const saveRequirement = async () => {
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(editingId.value ? `/api/requirements/${editingId.value}` : `/api/projects/${projectId.value}/requirements`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: requirementForm,
    })
    await refresh()
    closeDialog()
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

const saveRequirementStatus = async () => {
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(editingId.value ? `/api/requirement-statuses/${editingId.value}` : `/api/projects/${projectId.value}/requirement-statuses`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: requirementStatusForm,
    })
    await refresh()
    resetRequirementStatusForm()
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

const removeRequirementStatus = async (requirementStatus: RequirementStatus) => {
  if (!window.confirm(`确定删除状态“${requirementStatus.name}”吗？`)) return
  actionError.value = ''
  try {
    await $fetch(`/api/requirement-statuses/${requirementStatus.id}`, { method: 'DELETE' })
    await refresh()
    if (editingId.value === requirementStatus.id) resetRequirementStatusForm()
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  }
}

const saveRepository = async () => {
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(editingId.value ? `/api/repositories/${editingId.value}` : `/api/projects/${projectId.value}/repositories`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: repositoryForm,
    })
    await refresh()
    closeDialog()
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

const savePerson = async () => {
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(editingId.value ? `/api/people/${editingId.value}` : `/api/projects/${projectId.value}/people`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: personForm,
    })
    await refresh()
    closeDialog()
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

const removeRecord = async (kind: 'requirement' | 'repository' | 'person', id: string, label: string, referenceCount = 0) => {
  const referenceNote = referenceCount ? `，并从 ${referenceCount} 条需求中移除引用` : ''
  if (!window.confirm(`确定删除“${label}”${referenceNote}吗？`)) return
  actionError.value = ''
  try {
    const apiPath = kind === 'requirement' ? 'requirements' : kind === 'repository' ? 'repositories' : 'people'
    await $fetch(`/api/${apiPath}/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  }
}
</script>

<template>
  <div class="app-frame">
    <header class="site-header">
      <NuxtLink to="/" class="brand"><span>ASDP</span><small>Autonomous Software Delivery Platform</small></NuxtLink>
      <nav class="header-nav" aria-label="全局导航"><NuxtLink to="/">← 所有项目</NuxtLink><NuxtLink to="/settings">全局设置</NuxtLink></nav>
    </header>

    <main v-if="workspace" class="page workspace-page">
      <section class="workspace-heading">
        <div><p class="overline">PROJECT WORKSPACE</p><h1>{{ workspace.project.name }}</h1><p>{{ workspace.project.description || '暂无项目说明' }}</p></div>
        <div class="workspace-stats"><span><strong>{{ workspace.requirements.length }}</strong>需求</span><span><strong>{{ workspace.repositories.length }}</strong>仓库</span><span><strong>{{ workspace.people.length }}</strong>人员</span></div>
      </section>

      <nav class="tabs" aria-label="项目模块">
        <button type="button" :class="{ active: activeTab === 'requirements' }" @click="activeTab = 'requirements'">需求</button>
        <button type="button" :class="{ active: activeTab === 'assets' }" @click="activeTab = 'assets'">资产</button>
      </nav>

      <p v-if="actionError && !dialog" class="alert error-state">{{ actionError }}</p>

      <section v-if="activeTab === 'requirements'" class="module-section">
        <div class="section-heading">
          <div><h2>需求管理</h2><p>需求引用项目资产，并作为后续工作流运行的业务入口。</p></div>
          <div class="heading-actions"><button class="button secondary" type="button" @click="openStatusManager">状态管理</button><button class="button primary" type="button" @click="openRequirement()">新建需求</button></div>
        </div>
        <div v-if="workspace.requirements.length" class="requirement-list">
          <article v-for="requirement in workspace.requirements" :key="requirement.id" class="panel requirement-card">
            <div class="requirement-main">
              <div class="requirement-title-line"><h3>{{ requirement.title }}</h3><span class="status" :style="{ color: requirement.status.color, backgroundColor: `${requirement.status.color}18` }">{{ requirement.status.name }}</span><span class="priority" :data-priority="requirement.priority">{{ priorityLabel(requirement.priority) }}</span></div>
              <p>{{ requirement.description || '暂无需求说明' }}</p>
              <div class="asset-references">
                <span v-for="repository in requirement.repositories" :key="repository.id" class="chip repo-chip">⌘ {{ repository.name }}</span>
                <span v-for="person in requirement.people" :key="person.id" class="chip person-chip">{{ person.name }}</span>
                <span v-if="!requirement.repositories.length && !requirement.people.length" class="unbound">尚未引用资产</span>
              </div>
            </div>
            <div class="requirement-meta"><span>更新于 {{ formatDate(requirement.updatedAt) }}</span><div><button class="text-button" type="button" @click="openRequirement(requirement)">编辑</button><button class="text-button danger" type="button" @click="removeRecord('requirement', requirement.id, requirement.title)">删除</button></div></div>
          </article>
        </div>
        <div v-else class="panel empty-state"><strong>还没有需求</strong><span>创建第一条需求，并绑定代码仓库和参与人员。</span><button class="button primary" type="button" @click="openRequirement()">新建需求</button></div>
      </section>

      <section v-else class="module-section assets-module">
        <div class="section-heading"><div><h2>资产管理</h2><p>先在项目中登记代码仓库和人员，再由需求进行引用。</p></div></div>
        <div class="asset-columns">
          <section class="asset-group">
            <div class="asset-group-heading"><div><h3>代码仓库</h3><span>{{ workspace.repositories.length }} 条记录</span></div><button class="button secondary" type="button" @click="openRepository()">添加仓库</button></div>
            <article v-for="repository in workspace.repositories" :key="repository.id" class="panel asset-card">
              <div class="asset-icon repository-icon">⌘</div>
              <div class="asset-copy"><strong>{{ repository.name }} <span class="provider-badge">{{ repositoryProviderLabel(repository.provider) }}</span></strong><a :href="repository.url" target="_blank" rel="noreferrer">{{ repository.url }}</a><small>默认分支：{{ repository.defaultBranch }} · 被 {{ repository.referenceCount }} 条需求引用</small></div>
              <div class="asset-actions"><button class="text-button" type="button" @click="openRepository(repository)">编辑</button><button class="text-button danger" type="button" @click="removeRecord('repository', repository.id, repository.name, repository.referenceCount)">删除</button></div>
            </article>
            <div v-if="!workspace.repositories.length" class="panel empty-state compact"><span>尚未登记代码仓库</span><button class="text-button" type="button" @click="openRepository()">添加第一个仓库</button></div>
          </section>

          <section class="asset-group">
            <div class="asset-group-heading"><div><h3>项目人员</h3><span>{{ workspace.people.length }} 条记录</span></div><button class="button secondary" type="button" @click="openPerson()">添加人员</button></div>
            <article v-for="person in workspace.people" :key="person.id" class="panel asset-card">
              <div class="asset-icon person-icon">{{ person.name.slice(0, 1) }}</div>
              <div class="asset-copy"><strong>{{ person.name }}</strong><span>{{ person.email }}</span><small>{{ person.role || '未设置角色' }} · 被 {{ person.referenceCount }} 条需求引用</small></div>
              <div class="asset-actions"><button class="text-button" type="button" @click="openPerson(person)">编辑</button><button class="text-button danger" type="button" @click="removeRecord('person', person.id, person.name, person.referenceCount)">删除</button></div>
            </article>
            <div v-if="!workspace.people.length" class="panel empty-state compact"><span>尚未添加项目人员</span><button class="text-button" type="button" @click="openPerson()">添加第一位人员</button></div>
          </section>
        </div>
      </section>
    </main>

    <main v-else class="page"><div v-if="status === 'pending'" class="panel empty-state">正在读取项目…</div><div v-else class="panel empty-state error-state">{{ error?.statusMessage || '项目不存在' }}</div></main>

    <Teleport to="body">
      <div v-if="dialog" class="dialog-backdrop" @click.self="closeDialog">
        <form v-if="dialog === 'requirement'" class="dialog large" @submit.prevent="saveRequirement">
          <div class="dialog-heading"><div><p class="overline">REQUIREMENT</p><h2>{{ editingId ? '编辑需求' : '新建需求' }}</h2></div><button type="button" class="close-button" @click="closeDialog">×</button></div>
          <div class="form-grid two"><div class="field span-two"><label>标题</label><input v-model="requirementForm.title" required placeholder="描述要交付的功能" /></div><div class="field"><label>状态</label><select v-model="requirementForm.statusId" required><option v-for="requirementStatus in workspace?.requirementStatuses" :key="requirementStatus.id" :value="requirementStatus.id">{{ requirementStatus.name }}</option></select></div><div class="field"><label>优先级</label><select v-model="requirementForm.priority"><option v-for="option in priorityOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div><div class="field span-two"><label>需求说明</label><textarea v-model="requirementForm.description" rows="3" placeholder="说明背景、目标和范围" /></div><div class="field span-two"><label>验收标准</label><textarea v-model="requirementForm.acceptanceCriteria" rows="3" placeholder="说明怎样才算完成" /></div></div>
          <div class="reference-picker"><div><h3>引用代码仓库</h3><p>可以选择多个仓库</p></div><div v-if="workspace?.repositories.length" class="check-list"><label v-for="repository in workspace.repositories" :key="repository.id"><input v-model="requirementForm.repositoryIds" type="checkbox" :value="repository.id" /><span><strong>{{ repository.name }}</strong><small>{{ repositoryProviderLabel(repository.provider) }} · {{ repository.defaultBranch }}</small></span></label></div><p v-else class="picker-empty">请先在资产模块添加代码仓库。</p></div>
          <div class="reference-picker"><div><h3>引用项目人员</h3><p>可以选择多位参与者</p></div><div v-if="workspace?.people.length" class="check-list"><label v-for="person in workspace.people" :key="person.id"><input v-model="requirementForm.personIds" type="checkbox" :value="person.id" /><span><strong>{{ person.name }}</strong><small>{{ person.role || person.email }}</small></span></label></div><p v-else class="picker-empty">请先在资产模块添加人员。</p></div>
          <p v-if="actionError" class="form-error">{{ actionError }}</p>
          <div class="dialog-actions"><button class="button secondary" type="button" @click="closeDialog">取消</button><button class="button primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存需求' }}</button></div>
        </form>

        <div v-else-if="dialog === 'statuses'" class="dialog large status-dialog">
          <div class="dialog-heading"><div><p class="overline">REQUIREMENT STATUS</p><h2>需求状态管理</h2></div><button type="button" class="close-button" @click="closeDialog">×</button></div>
          <p class="dialog-intro">状态是当前项目的独立数据。需求引用状态记录，正在使用的状态不能直接删除。</p>
          <div class="status-manager">
            <div class="status-records">
              <article v-for="requirementStatus in workspace?.requirementStatuses" :key="requirementStatus.id" class="status-record" :class="{ selected: editingId === requirementStatus.id }">
                <span class="status-color" :style="{ backgroundColor: requirementStatus.color }" />
                <div><strong>{{ requirementStatus.name }}</strong><small>{{ requirementStatus.key }} · 排序 {{ requirementStatus.sortOrder }} · {{ requirementStatus.requirementCount }} 条需求</small><div class="status-flags"><span v-if="requirementStatus.isInitial">初始状态</span><span v-if="requirementStatus.isTerminal">终态</span></div></div>
                <div class="status-actions"><button class="text-button" type="button" @click="editRequirementStatus(requirementStatus)">编辑</button><button class="text-button danger" type="button" @click="removeRequirementStatus(requirementStatus)">删除</button></div>
              </article>
            </div>
            <form class="status-editor" @submit.prevent="saveRequirementStatus">
              <div class="status-editor-heading"><h3>{{ editingId ? '编辑状态' : '新增状态' }}</h3><button v-if="editingId" class="text-button" type="button" @click="resetRequirementStatusForm">新增状态</button></div>
              <div class="form-grid two"><div class="field"><label>显示名称</label><input v-model="requirementStatusForm.name" required placeholder="例如：评审中" /></div><div class="field"><label>唯一标识</label><input v-model="requirementStatusForm.key" required pattern="[a-z][a-z0-9_]*" placeholder="reviewing" /></div><div class="field"><label>颜色</label><div class="color-input"><input v-model="requirementStatusForm.color" type="color" /><input v-model="requirementStatusForm.color" required pattern="#[0-9a-fA-F]{6}" /></div></div><div class="field"><label>排序</label><input v-model.number="requirementStatusForm.sortOrder" required type="number" min="0" step="1" /></div></div>
              <label class="toggle-field"><input v-model="requirementStatusForm.isInitial" type="checkbox" :disabled="Boolean(editingId && requirementStatusForm.isInitial)" /><span><strong>初始状态</strong><small>新需求默认使用该状态</small></span></label>
              <label class="toggle-field"><input v-model="requirementStatusForm.isTerminal" type="checkbox" /><span><strong>终态</strong><small>表示需求生命周期已经结束</small></span></label>
              <p v-if="actionError" class="form-error">{{ actionError }}</p>
              <div class="dialog-actions"><button class="button primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : editingId ? '保存修改' : '新增状态' }}</button></div>
            </form>
          </div>
        </div>

        <form v-else-if="dialog === 'repository'" class="dialog repository-dialog" @submit.prevent="saveRepository">
          <div class="dialog-heading"><div><p class="overline">REPOSITORY ASSET</p><h2>{{ editingId ? '编辑代码仓库' : '添加代码仓库' }}</h2></div><button type="button" class="close-button" @click="closeDialog">×</button></div>
          <section v-if="!editingId && repositoryForm.provider === 'gitlab'" class="gitlab-picker"><div class="gitlab-picker-heading"><div><strong>从 GitLab 选择</strong><small>使用全局 Token 读取你有权访问的仓库</small></div><NuxtLink to="/settings" class="text-button">全局设置</NuxtLink></div><div class="gitlab-picker-search"><input v-model="gitlabRepositorySearch" placeholder="搜索 GitLab 仓库" @keydown.enter.prevent="loadGitLabRepositories" /><button class="button secondary" type="button" :disabled="gitlabRepositoriesLoading" @click="loadGitLabRepositories">{{ gitlabRepositoriesLoading ? '读取中…' : '查询' }}</button></div><p v-if="gitlabRepositoryError" class="picker-error">{{ gitlabRepositoryError }}</p><div v-if="gitlabRepositories.length" class="gitlab-results"><button v-for="repository in gitlabRepositories" :key="repository.id" type="button" :class="{ selected: repositoryForm.externalId === String(repository.id) }" @click="selectGitLabRepository(repository)"><span><strong>{{ repository.name }}</strong><small>{{ repository.nameWithNamespace }}</small></span><em>{{ repository.defaultBranch }}</em></button></div></section>
          <div class="field"><label>代码托管平台</label><select v-model="repositoryForm.provider" required><option v-for="option in repositoryProviderOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div><div class="field"><label>仓库名称</label><input v-model="repositoryForm.name" required placeholder="例如：asdp-web" /></div><div class="field"><label>{{ repositoryProviderLabel(repositoryForm.provider) }} 仓库地址</label><input v-model="repositoryForm.url" required type="url" :placeholder="repositoryUrlPlaceholder" @input="repositoryForm.externalId = null" /></div><div class="field"><label>默认分支</label><input v-model="repositoryForm.defaultBranch" required placeholder="main" /></div>
          <p v-if="actionError" class="form-error">{{ actionError }}</p><div class="dialog-actions"><button class="button secondary" type="button" @click="closeDialog">取消</button><button class="button primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存仓库' }}</button></div>
        </form>

        <form v-else-if="dialog === 'person'" class="dialog" @submit.prevent="savePerson">
          <div class="dialog-heading"><div><p class="overline">PROJECT MEMBER</p><h2>{{ editingId ? '编辑人员' : '添加人员' }}</h2></div><button type="button" class="close-button" @click="closeDialog">×</button></div>
          <div class="field"><label>姓名</label><input v-model="personForm.name" required placeholder="例如：陈嘉" /></div><div class="field"><label>邮箱</label><input v-model="personForm.email" required type="email" placeholder="name@example.com" /></div><div class="field"><label>项目角色</label><input v-model="personForm.role" placeholder="例如：技术负责人" /></div>
          <p v-if="actionError" class="form-error">{{ actionError }}</p><div class="dialog-actions"><button class="button secondary" type="button" @click="closeDialog">取消</button><button class="button primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存人员' }}</button></div>
        </form>
      </div>
    </Teleport>
  </div>
</template>

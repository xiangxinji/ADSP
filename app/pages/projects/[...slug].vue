<script setup lang="ts">
import type {
  EnvironmentAsset,
  EnvironmentType,
  GitLabRepository,
  GitLabRepositoryPage,
  KnowledgeAsset,
  KnowledgeReference,
  ProjectWorkspace,
  ProjectMember,
  RepositoryAsset,
  RepositoryProvider,
  Requirement,
  RequirementPriority,
  RequirementStatus,
  UserAccount,
} from '#shared/types/asdp'
import type { KnowledgeAssetReferenceOption } from '~/editor/knowledge-asset-reference'

type KnowledgeMarkdownEditorHandle = {
  getMarkdown: () => string
}

const route = useRoute()
const routeSegments = computed(() => Array.isArray(route.params.slug)
  ? route.params.slug.map(segment => String(segment))
  : [String(route.params.slug || '')])
const projectId = computed(() => routeSegments.value[0])
const projectPath = computed(() => `/projects/${projectId.value}`)
const assetsPath = computed(() => `${projectPath.value}/assets`)
const assetModules = ['repositories', 'members', 'environments', 'knowledge'] as const

type AssetModule = typeof assetModules[number]

const requestedSection = routeSegments.value[1]
const requestedModule = routeSegments.value[2]

if ((requestedSection && requestedSection !== 'assets')
  || (requestedModule && !assetModules.includes(requestedModule as AssetModule))
  || routeSegments.value.length > 3) {
  throw createError({ statusCode: 404, statusMessage: '项目页面不存在' })
}

if (!requestedSection && route.query.tab === 'assets') {
  const legacyModule = String(route.query.asset || '')
  const modulePath = assetModules.includes(legacyModule as AssetModule) ? `/${legacyModule}` : ''
  await navigateTo(`${assetsPath.value}${modulePath}`, { replace: true })
}

const workspaceUrl = computed(() => `/api/projects/${projectId.value}`)
const { data: workspace, status, error, refresh } = await useFetch<ProjectWorkspace>(workspaceUrl)
const { data: users, status: usersStatus, error: usersError } = await useFetch<UserAccount[]>('/api/users')

const activeTab = computed<'requirements' | 'assets'>(() => routeSegments.value[1] === 'assets' ? 'assets' : 'requirements')
const activeAssetModule = computed<AssetModule | null>(() => {
  const module = routeSegments.value[2] || ''
  return activeTab.value === 'assets' && assetModules.includes(module as AssetModule)
    ? module as AssetModule
    : null
})
const assetModuleLabel = computed(() => ({
  repositories: '代码仓库',
  members: '项目成员',
  environments: '环境管理',
  knowledge: '知识',
})[activeAssetModule.value || 'repositories'])
const dialog = ref<'requirement' | 'statuses' | 'versions' | 'repository' | 'member' | 'environment' | 'knowledge' | null>(null)
const editingId = ref<string | null>(null)
const saving = ref(false)
const actionError = ref('')
const { success } = useAppToast()

const requirementForm = reactive({
  title: '',
  description: '',
  acceptanceCriteria: '',
  statusId: '',
  priority: 'medium' as RequirementPriority,
  versionIds: [] as string[],
  repositoryIds: [] as string[],
  memberIds: [] as string[],
})
const repositoryForm = reactive({ provider: 'gitlab' as RepositoryProvider, externalId: null as string | null, name: '', note: '', url: '', defaultBranch: 'main' })
const gitlabRepositories = ref<GitLabRepository[]>([])
const gitlabRepositorySearch = ref('')
const gitlabRepositoriesLoading = ref(false)
const gitlabRepositoryError = ref('')
const memberForm = reactive({ userId: '', role: '项目成员' })
const environmentForm = reactive({
  address: '',
  type: 'development' as EnvironmentType,
  accounts: [''] as string[],
})
const knowledgeForm = reactive({ title: '', content: '' })
const knowledgeEditor = ref<KnowledgeMarkdownEditorHandle | null>(null)
const requirementStatusForm = reactive({
  key: '',
  name: '',
  color: '#2563eb',
  sortOrder: 10,
  isInitial: false,
  isTerminal: false,
})
const requirementVersionForm = reactive({ major: 1 })

type ConfirmationRequest = {
  title: string
  description: string
  confirmLabel: string
  action: () => Promise<void> | void
}

const confirmation = shallowRef<ConfirmationRequest | null>(null)
const confirmationBusy = ref(false)
const dialogSnapshot = ref('')

const currentDialogState = () => {
  switch (dialog.value) {
    case 'requirement': return { ...requirementForm }
    case 'statuses': return { editingId: editingId.value, ...requirementStatusForm }
    case 'versions': return { editingId: editingId.value, ...requirementVersionForm }
    case 'repository': return { ...repositoryForm }
    case 'member': return { ...memberForm }
    case 'environment': return { ...environmentForm, accounts: [...environmentForm.accounts] }
    case 'knowledge': return { ...knowledgeForm }
    default: return null
  }
}

const captureDialogSnapshot = () => {
  dialogSnapshot.value = JSON.stringify(currentDialogState())
}

const dialogHasChanges = () => Boolean(dialog.value) && JSON.stringify(currentDialogState()) !== dialogSnapshot.value

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

const environmentTypeOptions: { value: EnvironmentType, label: string }[] = [
  { value: 'development', label: '开发环境' },
  { value: 'testing', label: '测试环境' },
  { value: 'production', label: '生产环境' },
]

const priorityLabel = (value: RequirementPriority) => priorityOptions.find(option => option.value === value)?.label || value
const repositoryProviderLabel = (value: RepositoryProvider) => repositoryProviderOptions.find(option => option.value === value)?.label || value
const environmentTypeLabel = (value: EnvironmentType) => environmentTypeOptions.find(option => option.value === value)?.label || value
const repositoryUrlPlaceholder = computed(() => repositoryForm.provider === 'github'
  ? 'https://github.com/team/repo.git'
  : 'https://gitlab.example.com/team/repo.git')
const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const selectableUsers = computed(() => {
  const assignedUserIds = new Set(workspace.value?.members.map(member => member.userId) || [])
  const editingUserId = editingId.value ? memberForm.userId : ''
  return (users.value || []).filter(user => user.id === editingUserId || !assignedUserIds.has(user.id))
})
const knowledgeReferenceOptions = computed<KnowledgeAssetReferenceOption[]>(() => [
  ...(workspace.value?.repositories || []).map(repository => ({
    assetType: '代码仓库',
    targetType: 'repository' as const,
    recordId: repository.id,
    label: repository.name,
    detail: `${repositoryProviderLabel(repository.provider)} · ${repository.defaultBranch}`,
  })),
  ...(workspace.value?.members || []).map(member => ({
    assetType: '项目成员',
    targetType: 'member' as const,
    recordId: member.id,
    label: member.user.name,
    detail: `${member.role} · ${member.user.email}`,
  })),
  ...(workspace.value?.environments || []).map(environment => ({
    assetType: '环境',
    targetType: 'environment' as const,
    recordId: environment.id,
    label: environment.address,
    detail: `${environmentTypeLabel(environment.type)} · ${environment.accounts.join('、')}`,
  })),
  ...(workspace.value?.knowledge || [])
    .filter(knowledge => knowledge.id !== editingId.value)
    .map(knowledge => ({
      assetType: '知识',
      targetType: 'knowledge' as const,
      recordId: knowledge.id,
      label: knowledge.title,
      detail: 'Markdown 知识',
    })),
])

const openRequirement = (requirement?: Requirement) => {
  editingId.value = requirement?.id || null
  Object.assign(requirementForm, requirement ? {
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
    statusId: workspace.value?.requirementStatuses.find(status => status.isInitial)?.id || workspace.value?.requirementStatuses[0]?.id || '',
    priority: 'medium',
    versionIds: [],
    repositoryIds: [],
    memberIds: [],
  })
  actionError.value = ''
  dialog.value = 'requirement'
  captureDialogSnapshot()
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
  if (dialog.value === 'statuses') captureDialogSnapshot()
}

const openStatusManager = () => {
  resetRequirementStatusForm()
  dialog.value = 'statuses'
  captureDialogSnapshot()
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
  captureDialogSnapshot()
}

const resetRequirementVersionForm = () => {
  editingId.value = null
  requirementVersionForm.major = (workspace.value?.requirementVersions[0]?.major ?? 0) + 1
  actionError.value = ''
  if (dialog.value === 'versions') captureDialogSnapshot()
}

const openVersionManager = () => {
  resetRequirementVersionForm()
  dialog.value = 'versions'
  captureDialogSnapshot()
}

const editRequirementVersion = (version: ProjectWorkspace['requirementVersions'][number]) => {
  editingId.value = version.id
  requirementVersionForm.major = version.major
  actionError.value = ''
  captureDialogSnapshot()
}

const openRepository = (repository?: RepositoryAsset) => {
  editingId.value = repository?.id || null
  Object.assign(repositoryForm, repository ? {
    provider: repository.provider, externalId: repository.externalId, name: repository.name, note: repository.note, url: repository.url, defaultBranch: repository.defaultBranch,
  } : { provider: 'gitlab', externalId: null, name: '', note: '', url: '', defaultBranch: 'main' })
  gitlabRepositories.value = []
  gitlabRepositorySearch.value = ''
  gitlabRepositoryError.value = ''
  actionError.value = ''
  dialog.value = 'repository'
  captureDialogSnapshot()
  if (!repository) void loadGitLabRepositories()
}

const openMember = (member?: ProjectMember) => {
  editingId.value = member?.id || null
  Object.assign(memberForm, member
    ? { userId: member.userId, role: member.role }
    : { userId: selectableUsers.value[0]?.id || '', role: '项目成员' })
  actionError.value = ''
  dialog.value = 'member'
  captureDialogSnapshot()
}

const openEnvironment = (environment?: EnvironmentAsset) => {
  editingId.value = environment?.id || null
  Object.assign(environmentForm, environment ? {
    address: environment.address,
    type: environment.type,
    accounts: [...environment.accounts],
  } : {
    address: '',
    type: 'development',
    accounts: [''],
  })
  actionError.value = ''
  dialog.value = 'environment'
  captureDialogSnapshot()
}

const openKnowledge = (knowledge?: KnowledgeAsset) => {
  editingId.value = knowledge?.id || null
  Object.assign(knowledgeForm, knowledge
    ? { title: knowledge.title, content: knowledge.content }
    : { title: '', content: '' })
  actionError.value = ''
  dialog.value = 'knowledge'
  captureDialogSnapshot()
}

const knowledgeReferencePath = (reference: KnowledgeReference) => {
  if (!reference.resolved || !reference.targetType) return ''
  const module = {
    repository: 'repositories',
    member: 'members',
    environment: 'environments',
    knowledge: 'knowledge',
  }[reference.targetType]
  return `${assetsPath.value}/${module}#asset-${reference.recordId}`
}

const knowledgeReferenceLabel = (reference: KnowledgeReference) => reference.label
  || `${reference.assetType}：${reference.recordId}`

const addEnvironmentAccount = () => environmentForm.accounts.push('')

const removeEnvironmentAccount = (index: number) => {
  if (environmentForm.accounts.length === 1) {
    environmentForm.accounts[0] = ''
    return
  }
  environmentForm.accounts.splice(index, 1)
}

const closeDialog = () => {
  dialog.value = null
  editingId.value = null
  actionError.value = ''
  dialogSnapshot.value = ''
}

const errorMessage = (requestError: any) => requestError?.data?.statusMessage || requestError?.message || '操作失败'

const requestConfirmation = (request: ConfirmationRequest) => {
  confirmation.value = request
}

const cancelConfirmation = () => {
  if (!confirmationBusy.value) confirmation.value = null
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

const requestDialogClose = () => {
  if (saving.value) return
  if (!dialogHasChanges()) {
    closeDialog()
    return
  }
  requestConfirmation({
    title: '放弃未保存的修改？',
    description: '当前弹框中的修改尚未保存，放弃后无法恢复。',
    confirmLabel: '放弃修改',
    action: closeDialog,
  })
}

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
    success('需求已保存')
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
    success('需求状态已保存')
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

const removeRequirementStatus = (requirementStatus: RequirementStatus) => {
  requestConfirmation({
    title: `删除状态“${requirementStatus.name}”？`,
    description: '删除后无法恢复。正在被需求引用的状态不会被系统删除。',
    confirmLabel: '删除状态',
    action: async () => {
      actionError.value = ''
      try {
        await $fetch(`/api/requirement-statuses/${requirementStatus.id}`, { method: 'DELETE' })
        await refresh()
        if (editingId.value === requirementStatus.id) resetRequirementStatusForm()
        success(`状态“${requirementStatus.name}”已删除`)
      } catch (requestError) {
        actionError.value = errorMessage(requestError)
      }
    },
  })
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
    success('代码仓库已保存')
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

const saveMember = async () => {
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(editingId.value ? `/api/members/${editingId.value}` : `/api/projects/${projectId.value}/members`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: memberForm,
    })
    await refresh()
    closeDialog()
    success('项目成员已保存')
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

const saveEnvironment = async () => {
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(editingId.value ? `/api/environments/${editingId.value}` : `/api/projects/${projectId.value}/environments`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: {
        ...environmentForm,
        accounts: environmentForm.accounts.map(account => account.trim()).filter(Boolean),
      },
    })
    await refresh()
    closeDialog()
    success('项目环境已保存')
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

const saveRequirementVersion = async () => {
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(editingId.value ? `/api/requirement-versions/${editingId.value}` : `/api/projects/${projectId.value}/requirement-versions`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: requirementVersionForm,
    })
    await refresh()
    resetRequirementVersionForm()
    success('需求版本已保存')
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

const removeRequirementVersion = (version: ProjectWorkspace['requirementVersions'][number]) => {
  requestConfirmation({
    title: `删除版本“${version.name}”？`,
    description: '删除后无法恢复。正在被需求引用的版本不会被系统删除。',
    confirmLabel: '删除版本',
    action: async () => {
      actionError.value = ''
      try {
        await $fetch(`/api/requirement-versions/${version.id}`, { method: 'DELETE' })
        await refresh()
        if (editingId.value === version.id) resetRequirementVersionForm()
        success(`版本“${version.name}”已删除`)
      } catch (requestError) {
        actionError.value = errorMessage(requestError)
      }
    },
  })
}

const saveKnowledge = async () => {
  knowledgeForm.content = knowledgeEditor.value?.getMarkdown() ?? knowledgeForm.content
  if (!knowledgeForm.content.trim()) {
    actionError.value = '请输入 Markdown 内容'
    return
  }
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(editingId.value ? `/api/knowledge/${editingId.value}` : `/api/projects/${projectId.value}/knowledge`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: knowledgeForm,
    })
    await refresh()
    closeDialog()
    success('知识文档已保存')
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

const removeRecord = (kind: 'requirement' | 'repository' | 'member' | 'environment' | 'knowledge', id: string, label: string, referenceCount = 0) => {
  const referenceNote = referenceCount ? `，并从 ${referenceCount} 条需求中移除引用` : ''
  requestConfirmation({
    title: `删除“${label}”？`,
    description: `删除后无法恢复${referenceNote}。`,
    confirmLabel: kind === 'member' ? '移除成员' : '确认删除',
    action: async () => {
      actionError.value = ''
      try {
        const apiPath = {
          requirement: 'requirements',
          repository: 'repositories',
          member: 'members',
          environment: 'environments',
          knowledge: 'knowledge',
        }[kind]
        await $fetch(`/api/${apiPath}/${id}`, { method: 'DELETE' })
        await refresh()
        success(`“${label}”已${kind === 'member' ? '移除' : '删除'}`)
      } catch (requestError) {
        actionError.value = errorMessage(requestError)
      }
    },
  })
}
</script>

<template>
  <div class="app-frame">
    <AppHeader />

    <main v-if="workspace" id="main-content" class="page workspace-page">
      <nav class="breadcrumbs" aria-label="当前位置">
        <NuxtLink to="/">项目</NuxtLink><span aria-hidden="true">/</span>
        <NuxtLink :to="projectPath">{{ workspace.project.name }}</NuxtLink><span aria-hidden="true">/</span>
        <template v-if="activeTab === 'requirements'"><span aria-current="page">需求</span></template>
        <template v-else>
          <NuxtLink v-if="activeAssetModule" :to="assetsPath">资产</NuxtLink>
          <span v-else aria-current="page">资产</span>
          <template v-if="activeAssetModule"><span aria-hidden="true">/</span><span aria-current="page">{{ assetModuleLabel }}</span></template>
        </template>
      </nav>

      <section class="workspace-heading">
        <div><p class="overline">PROJECT WORKSPACE</p><h1>{{ workspace.project.name }}</h1><p>{{ workspace.project.description || '暂无项目说明' }}</p></div>
        <div class="workspace-stats"><span><strong>{{ workspace.requirements.length }}</strong>需求</span><span><strong>{{ workspace.requirementVersions.length }}</strong>版本</span><span><strong>{{ workspace.repositories.length }}</strong>仓库</span><span><strong>{{ workspace.members.length }}</strong>成员</span><span><strong>{{ workspace.environments.length }}</strong>环境</span><span><strong>{{ workspace.knowledge.length }}</strong>知识</span></div>
      </section>

      <nav class="tabs" aria-label="项目模块">
        <NuxtLink :to="projectPath" :class="{ active: activeTab === 'requirements' }" :aria-current="activeTab === 'requirements' ? 'page' : undefined">需求</NuxtLink>
        <NuxtLink :to="assetsPath" :class="{ active: activeTab === 'assets' }" :aria-current="activeTab === 'assets' ? 'page' : undefined">资产</NuxtLink>
      </nav>

      <p v-if="actionError && !dialog" class="alert error-state" role="alert">{{ actionError }}</p>

      <section v-if="activeTab === 'requirements'" class="module-section">
        <div class="section-heading">
          <div><h2>需求管理</h2><p>需求引用项目资产，并作为后续工作流运行的业务入口。</p></div>
          <div class="heading-actions"><button class="button secondary" type="button" @click="openVersionManager">版本管理</button><button class="button secondary" type="button" @click="openStatusManager">状态管理</button><button class="button primary" type="button" @click="openRequirement()">新建需求</button></div>
        </div>
        <div v-if="workspace.requirements.length" class="requirement-list">
          <article v-for="requirement in workspace.requirements" :key="requirement.id" class="panel requirement-card">
            <div class="requirement-main">
              <div class="requirement-title-line"><h3>{{ requirement.title }}</h3><span class="status" :style="{ color: requirement.status.color, backgroundColor: `${requirement.status.color}18` }">{{ requirement.status.name }}</span><span class="priority" :data-priority="requirement.priority">{{ priorityLabel(requirement.priority) }}</span></div>
              <p>{{ requirement.description || '暂无需求说明' }}</p>
              <div class="asset-references">
                <span v-for="version in requirement.versions" :key="version.id" class="chip version-chip">{{ version.name }}<em v-if="version.isLatest">latest</em></span>
                <span v-for="repository in requirement.repositories" :key="repository.id" class="chip repo-chip"><AppIcon name="repository" :size="13" />{{ repository.name }}</span>
                <span v-for="member in requirement.members" :key="member.id" class="chip member-chip">{{ member.user.name }}</span>
                <span v-if="!requirement.versions.length && !requirement.repositories.length && !requirement.members.length" class="unbound">尚未关联版本或资产</span>
              </div>
            </div>
            <div class="requirement-meta"><span>更新于 {{ formatDate(requirement.updatedAt) }}</span><div><button class="text-button" type="button" @click="openRequirement(requirement)">编辑</button><button class="text-button danger" type="button" @click="removeRecord('requirement', requirement.id, requirement.title)">删除</button></div></div>
          </article>
        </div>
        <div v-else class="panel empty-state"><strong>还没有需求</strong><span>创建第一条需求，并绑定代码仓库和项目成员。</span><button class="button primary" type="button" @click="openRequirement()">新建需求</button></div>
      </section>

      <section v-else class="module-section assets-module">
        <template v-if="!activeAssetModule">
          <div class="section-heading">
            <div><h2>资产管理</h2><p>按资产类型进入独立空间，查看和维护当前项目的交付资源。</p></div>
          </div>

          <div class="asset-module-grid">
            <NuxtLink class="panel asset-module-card" :to="`${assetsPath}/repositories`">
              <span class="asset-module-icon repository-icon"><AppIcon name="repository" :size="22" /></span>
              <span class="asset-module-copy"><strong>代码仓库</strong><small>管理 GitLab、GitHub 仓库连接与默认分支</small></span>
              <span class="asset-module-meta"><strong>{{ workspace.repositories.length }}</strong><small>个仓库</small></span>
              <span class="asset-module-link">进入管理 <span aria-hidden="true">→</span></span>
            </NuxtLink>

            <NuxtLink class="panel asset-module-card" :to="`${assetsPath}/members`">
              <span class="asset-module-icon member-icon"><AppIcon name="members" :size="22" /></span>
              <span class="asset-module-copy"><strong>项目成员</strong><small>从全局用户中选择成员并设置项目角色</small></span>
              <span class="asset-module-meta"><strong>{{ workspace.members.length }}</strong><small>位成员</small></span>
              <span class="asset-module-link">进入管理 <span aria-hidden="true">→</span></span>
            </NuxtLink>

            <NuxtLink class="panel asset-module-card" :to="`${assetsPath}/environments`">
              <span class="asset-module-icon environment-icon"><AppIcon name="environment" :size="22" /></span>
              <span class="asset-module-copy"><strong>环境管理</strong><small>维护开发、测试和生产环境的访问入口</small></span>
              <span class="asset-module-meta"><strong>{{ workspace.environments.length }}</strong><small>个环境</small></span>
              <span class="asset-module-link">进入管理 <span aria-hidden="true">→</span></span>
            </NuxtLink>

            <NuxtLink class="panel asset-module-card" :to="`${assetsPath}/knowledge`">
              <span class="asset-module-icon knowledge-icon"><AppIcon name="knowledge" :size="22" /></span>
              <span class="asset-module-copy"><strong>知识</strong><small>用 Markdown 沉淀项目知识，并引用项目内其他资产</small></span>
              <span class="asset-module-meta"><strong>{{ workspace.knowledge.length }}</strong><small>篇文档</small></span>
              <span class="asset-module-link">进入管理 <span aria-hidden="true">→</span></span>
            </NuxtLink>
          </div>

          <aside class="asset-security-note">
            <span><AppIcon name="shield-check" :size="16" /></span>
            <p><strong>凭据始终由交付系统保管</strong>ForgePilot 只记录资产标识与访问地址，不保存密码、Token 或私钥。</p>
          </aside>
        </template>

        <template v-else-if="activeAssetModule === 'repositories'">
          <div class="asset-detail-heading">
            <div class="section-heading"><div><p class="overline">REPOSITORY ASSETS</p><h2>代码仓库</h2><p>管理项目引用的源代码仓库和默认分支。</p></div><button class="button primary" type="button" @click="openRepository()">添加仓库</button></div>
          </div>
          <div v-if="workspace.repositories.length" class="asset-record-list">
            <article v-for="repository in workspace.repositories" :id="`asset-${repository.id}`" :key="repository.id" class="panel asset-card asset-record-card">
              <div class="asset-icon repository-icon"><AppIcon name="repository" :size="18" /></div>
              <div class="asset-copy"><strong>{{ repository.name }} <span class="provider-badge">{{ repositoryProviderLabel(repository.provider) }}</span></strong><a :href="repository.url" target="_blank" rel="noreferrer">{{ repository.url }}</a><span v-if="repository.note" class="asset-note">备注：{{ repository.note }}</span><small>默认分支：{{ repository.defaultBranch }} · 被 {{ repository.referenceCount }} 条需求引用</small></div>
              <div class="asset-actions"><button class="text-button" type="button" @click="openRepository(repository)">编辑</button><button class="text-button danger" type="button" @click="removeRecord('repository', repository.id, repository.name, repository.referenceCount)">删除</button></div>
            </article>
          </div>
          <div v-else class="panel empty-state"><strong>还没有代码仓库</strong><span>添加仓库后，需求可以直接引用它。</span><button class="button primary" type="button" @click="openRepository()">添加第一个仓库</button></div>
        </template>

        <template v-else-if="activeAssetModule === 'members'">
          <div class="asset-detail-heading">
            <div class="section-heading"><div><p class="overline">PROJECT MEMBERS</p><h2>项目成员</h2><p>选择全局用户加入项目，并维护其项目角色。</p></div><button class="button primary" type="button" @click="openMember()">添加成员</button></div>
          </div>
          <div v-if="workspace.members.length" class="asset-record-list">
            <article v-for="member in workspace.members" :id="`asset-${member.id}`" :key="member.id" class="panel asset-card asset-record-card">
              <div class="asset-icon member-icon">{{ member.user.name.slice(0, 1) }}</div>
              <div class="asset-copy"><strong>{{ member.user.name }}</strong><span>{{ member.user.email }}</span><small>{{ member.role }} · 被 {{ member.referenceCount }} 条需求引用</small></div>
              <div class="asset-actions"><button class="text-button" type="button" @click="openMember(member)">编辑角色</button><button class="text-button danger" type="button" @click="removeRecord('member', member.id, member.user.name, member.referenceCount)">移除</button></div>
            </article>
          </div>
          <div v-else class="panel empty-state"><strong>还没有项目成员</strong><span>从全局用户中选择成员，并为其设置项目角色。</span><button class="button primary" type="button" @click="openMember()">添加第一位成员</button></div>
        </template>

        <template v-else-if="activeAssetModule === 'environments'">
          <div class="asset-detail-heading">
            <div class="section-heading"><div><p class="overline">ENVIRONMENT ASSETS</p><h2>环境管理</h2><p>维护项目开发、测试和生产环境的访问入口。</p></div><button class="button primary" type="button" @click="openEnvironment()">添加环境</button></div>
          </div>
          <div v-if="workspace.environments.length" class="asset-record-list">
            <article v-for="environment in workspace.environments" :id="`asset-${environment.id}`" :key="environment.id" class="panel asset-card asset-record-card">
              <div class="asset-icon environment-icon"><AppIcon name="environment" :size="18" /></div>
              <div class="asset-copy"><strong>项目环境 <span class="provider-badge environment-badge" :data-environment="environment.type">{{ environmentTypeLabel(environment.type) }}</span></strong><a :href="environment.address" target="_blank" rel="noreferrer">{{ environment.address }}</a><small>账号：{{ environment.accounts.join('、') }}</small></div>
              <div class="asset-actions"><button class="text-button" type="button" @click="openEnvironment(environment)">编辑</button><button class="text-button danger" type="button" @click="removeRecord('environment', environment.id, environment.address)">删除</button></div>
            </article>
          </div>
          <div v-else class="panel empty-state"><strong>还没有项目环境</strong><span>登记环境地址与账号标识，凭据仍由交付系统保管。</span><button class="button primary" type="button" @click="openEnvironment()">添加第一个环境</button></div>
        </template>

        <template v-else>
          <div class="asset-detail-heading">
            <div class="section-heading"><div><p class="overline">KNOWLEDGE ASSETS</p><h2>知识</h2><p>使用 Markdown 沉淀项目上下文，并通过稳定记录 ID 引用其他资产。</p></div><button class="button primary" type="button" @click="openKnowledge()">添加知识</button></div>
          </div>
          <div v-if="workspace.knowledge.length" class="asset-record-list knowledge-record-list">
            <article v-for="knowledge in workspace.knowledge" :id="`asset-${knowledge.id}`" :key="knowledge.id" class="panel asset-card asset-record-card knowledge-card">
              <div class="asset-icon knowledge-icon"><AppIcon name="knowledge" :size="18" /></div>
              <div class="asset-copy knowledge-copy">
                <strong>{{ knowledge.title }}</strong>
                <pre>{{ knowledge.content }}</pre>
                <div v-if="knowledge.references.length" class="knowledge-references">
                  <template v-for="reference in knowledge.references" :key="`${reference.assetType}:${reference.recordId}`">
                    <NuxtLink v-if="reference.resolved" class="chip knowledge-reference" :to="knowledgeReferencePath(reference)">{{ knowledgeReferenceLabel(reference) }}</NuxtLink>
                    <span v-else class="chip knowledge-reference unresolved">未解析 · {{ knowledgeReferenceLabel(reference) }}</span>
                  </template>
                </div>
                <small>Markdown · {{ knowledge.references.length }} 个资产引用 · 更新于 {{ formatDate(knowledge.updatedAt) }}</small>
              </div>
              <div class="asset-actions"><button class="text-button" type="button" @click="openKnowledge(knowledge)">编辑</button><button class="text-button danger" type="button" @click="removeRecord('knowledge', knowledge.id, knowledge.title)">删除</button></div>
            </article>
          </div>
          <div v-else class="panel empty-state"><strong>还没有项目知识</strong><span>添加 Markdown 文档，把架构、约定和决策与项目资产关联起来。</span><button class="button primary" type="button" @click="openKnowledge()">添加第一篇知识</button></div>
        </template>
      </section>
    </main>

    <main v-else id="main-content" class="page"><AppAsyncState :pending="status === 'pending'" :error-message="error?.statusMessage || '项目不存在'" @retry="refresh" /></main>

    <AppDialog :open="dialog === 'requirement'" :title="editingId ? '编辑需求' : '新建需求'" overline="REQUIREMENT" class="large" :busy="saving" @request-close="requestDialogClose">
      <form id="requirement-form" @submit.prevent="saveRequirement">
        <div class="form-grid two">
          <div class="field span-two"><label for="requirement-title">标题</label><input id="requirement-title" v-model="requirementForm.title" required autofocus placeholder="描述要交付的功能" /></div>
          <div class="field"><label for="requirement-status">状态</label><select id="requirement-status" v-model="requirementForm.statusId" required><option v-for="requirementStatus in workspace?.requirementStatuses" :key="requirementStatus.id" :value="requirementStatus.id">{{ requirementStatus.name }}</option></select></div>
          <div class="field"><label for="requirement-priority">优先级</label><select id="requirement-priority" v-model="requirementForm.priority"><option v-for="option in priorityOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div>
          <div class="field span-two"><label for="requirement-description">需求说明</label><textarea id="requirement-description" v-model="requirementForm.description" rows="3" placeholder="说明背景、目标和范围" /></div>
          <div class="field span-two"><label for="requirement-acceptance">验收标准</label><textarea id="requirement-acceptance" v-model="requirementForm.acceptanceCriteria" rows="3" placeholder="说明怎样才算完成" /></div>
        </div>
        <div class="reference-picker"><div><h3>关联版本</h3><p>可以选择多个大版本</p></div><div v-if="workspace?.requirementVersions.length" class="check-list"><label v-for="version in workspace.requirementVersions" :key="version.id"><input v-model="requirementForm.versionIds" type="checkbox" :value="version.id" /><span><strong>{{ version.name }} <em v-if="version.isLatest" class="latest-label">latest</em></strong><small>{{ version.requirementCount }} 条需求已关联</small></span></label></div><p v-else class="picker-empty">请先在版本管理中添加大版本。</p></div>
        <div class="reference-picker"><div><h3>引用代码仓库</h3><p>可以选择多个仓库</p></div><div v-if="workspace?.repositories.length" class="check-list"><label v-for="repository in workspace.repositories" :key="repository.id"><input v-model="requirementForm.repositoryIds" type="checkbox" :value="repository.id" /><span><strong>{{ repository.name }}</strong><small>{{ repositoryProviderLabel(repository.provider) }} · {{ repository.defaultBranch }}<template v-if="repository.note"> · {{ repository.note }}</template></small></span></label></div><p v-else class="picker-empty">请先在资产模块添加代码仓库。</p></div>
        <div class="reference-picker"><div><h3>引用项目成员</h3><p>可以选择多位参与者</p></div><div v-if="workspace?.members.length" class="check-list"><label v-for="member in workspace.members" :key="member.id"><input v-model="requirementForm.memberIds" type="checkbox" :value="member.id" /><span><strong>{{ member.user.name }}</strong><small>{{ member.role || member.user.email }}</small></span></label></div><p v-else class="picker-empty">请先在资产模块添加成员。</p></div>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
      </form>
      <template #actions><button class="button secondary" type="button" :disabled="saving" @click="requestDialogClose">取消</button><button class="button primary" type="submit" form="requirement-form" :disabled="saving">{{ saving ? '保存中…' : '保存需求' }}</button></template>
    </AppDialog>

    <AppDialog :open="dialog === 'statuses'" title="需求状态管理" overline="REQUIREMENT STATUS" class="large status-dialog" :busy="saving" @request-close="requestDialogClose">
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
          <div class="form-grid two">
            <div class="field"><label for="status-name">显示名称</label><input id="status-name" v-model="requirementStatusForm.name" required autofocus placeholder="例如：评审中" /></div>
            <div class="field"><label for="status-key">唯一标识</label><input id="status-key" v-model="requirementStatusForm.key" required pattern="[a-z][a-z0-9_]*" placeholder="reviewing" /></div>
            <div class="field"><label for="status-color">颜色</label><div class="color-input"><input aria-label="选择状态颜色" v-model="requirementStatusForm.color" type="color" /><input id="status-color" v-model="requirementStatusForm.color" required pattern="#[0-9a-fA-F]{6}" /></div></div>
            <div class="field"><label for="status-sort">排序</label><input id="status-sort" v-model.number="requirementStatusForm.sortOrder" required type="number" min="0" step="1" /></div>
          </div>
          <label class="toggle-field"><input v-model="requirementStatusForm.isInitial" type="checkbox" :disabled="Boolean(editingId && requirementStatusForm.isInitial)" /><span><strong>初始状态</strong><small>新需求默认使用该状态</small></span></label>
          <label class="toggle-field"><input v-model="requirementStatusForm.isTerminal" type="checkbox" /><span><strong>终态</strong><small>表示需求生命周期已经结束</small></span></label>
          <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
          <div class="dialog-actions"><button class="button primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : editingId ? '保存修改' : '新增状态' }}</button></div>
        </form>
      </div>
    </AppDialog>

    <AppDialog :open="dialog === 'versions'" title="需求版本管理" overline="REQUIREMENT VERSION" class="large status-dialog" :busy="saving" @request-close="requestDialogClose">
      <p class="dialog-intro">只维护大版本号，系统固定展示为 v${大版本号}.x；数值最大的版本自动标记为 latest。</p>
      <div class="status-manager">
        <div class="status-records">
          <article v-for="version in workspace?.requirementVersions" :key="version.id" class="status-record version-record" :class="{ selected: editingId === version.id }"><div><strong>{{ version.name }} <em v-if="version.isLatest" class="latest-label">latest</em></strong><small>大版本号 {{ version.major }} · {{ version.requirementCount }} 条需求</small></div><div class="status-actions"><button class="text-button" type="button" @click="editRequirementVersion(version)">编辑</button><button class="text-button danger" type="button" @click="removeRequirementVersion(version)">删除</button></div></article>
          <p v-if="!workspace?.requirementVersions.length" class="picker-empty">还没有版本，请先添加一个大版本。</p>
        </div>
        <form class="status-editor" @submit.prevent="saveRequirementVersion">
          <div class="status-editor-heading"><h3>{{ editingId ? '编辑版本' : '新增版本' }}</h3><button v-if="editingId" class="text-button" type="button" @click="resetRequirementVersionForm">新增版本</button></div>
          <div class="field"><label for="version-major">大版本号</label><input id="version-major" v-model.number="requirementVersionForm.major" required autofocus type="number" min="0" step="1" placeholder="例如：3" /><small>将显示为 v{{ requirementVersionForm.major }}.x</small></div>
          <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
          <div class="dialog-actions"><button class="button primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : editingId ? '保存修改' : '新增版本' }}</button></div>
        </form>
      </div>
    </AppDialog>

    <AppDialog :open="dialog === 'repository'" :title="editingId ? '编辑代码仓库' : '添加代码仓库'" overline="REPOSITORY ASSET" class="repository-dialog" :busy="saving" @request-close="requestDialogClose">
      <form id="repository-form" @submit.prevent="saveRepository">
        <section v-if="!editingId && repositoryForm.provider === 'gitlab'" class="gitlab-picker"><div class="gitlab-picker-heading"><div><strong>从 GitLab 选择</strong><small>使用全局 Token 读取你有权访问的仓库</small></div><NuxtLink to="/settings" class="text-button">全局设置</NuxtLink></div><div class="gitlab-picker-search"><label class="sr-only" for="gitlab-repository-search">搜索 GitLab 仓库</label><input id="gitlab-repository-search" v-model="gitlabRepositorySearch" placeholder="搜索 GitLab 仓库" @keydown.enter.prevent="loadGitLabRepositories" /><button class="button secondary" type="button" :disabled="gitlabRepositoriesLoading" @click="loadGitLabRepositories">{{ gitlabRepositoriesLoading ? '读取中…' : '查询' }}</button></div><p v-if="gitlabRepositoryError" class="picker-error" role="alert">{{ gitlabRepositoryError }}</p><div v-if="gitlabRepositories.length" class="gitlab-results"><button v-for="repository in gitlabRepositories" :key="repository.id" type="button" :class="{ selected: repositoryForm.externalId === String(repository.id) }" @click="selectGitLabRepository(repository)"><span><strong>{{ repository.name }}</strong><small>{{ repository.nameWithNamespace }}</small></span><em>{{ repository.defaultBranch }}</em></button></div></section>
        <div class="field"><label for="repository-provider">代码托管平台</label><select id="repository-provider" v-model="repositoryForm.provider" required><option v-for="option in repositoryProviderOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div>
        <div class="field"><label for="repository-name">仓库名称</label><input id="repository-name" v-model="repositoryForm.name" required placeholder="例如：forgepilot-web" /></div>
        <div class="field"><label for="repository-note">备注</label><textarea id="repository-note" v-model="repositoryForm.note" maxlength="500" placeholder="例如：前端主仓库，负责 ForgePilot 控制台"></textarea><small>可填写仓库用途、维护范围或其他说明。</small></div>
        <div class="field"><label for="repository-url">{{ repositoryProviderLabel(repositoryForm.provider) }} 仓库地址</label><input id="repository-url" v-model="repositoryForm.url" required type="url" :placeholder="repositoryUrlPlaceholder" @input="repositoryForm.externalId = null" /></div>
        <div class="field"><label for="repository-branch">默认分支</label><input id="repository-branch" v-model="repositoryForm.defaultBranch" required placeholder="main" /></div>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
      </form>
      <template #actions><button class="button secondary" type="button" :disabled="saving" @click="requestDialogClose">取消</button><button class="button primary" type="submit" form="repository-form" :disabled="saving">{{ saving ? '保存中…' : '保存仓库' }}</button></template>
    </AppDialog>

    <AppDialog :open="dialog === 'knowledge'" :title="editingId ? '编辑知识' : '添加知识'" overline="KNOWLEDGE ASSET" class="large knowledge-dialog" :busy="saving" @request-close="requestDialogClose">
      <form id="knowledge-form" @submit.prevent="saveKnowledge">
        <p class="dialog-intro">正文以 Markdown 原文保存。在编辑器中输入 <code>/</code>，可从命令面板选择并引用当前项目的其他知识。</p>
        <div class="field"><label for="knowledge-title">标题</label><input id="knowledge-title" v-model="knowledgeForm.title" required autofocus placeholder="例如：项目架构约定" /></div>
        <div class="field"><span id="knowledge-content-label" class="field-label">Markdown 内容</span><KnowledgeMarkdownEditor ref="knowledgeEditor" v-model="knowledgeForm.content" :references="knowledgeReferenceOptions" role="group" aria-labelledby="knowledge-content-label" /><small>输入 <code>/</code> 打开命令面板；知识引用会显示为控件，并按稳定引用语法存入数据库。</small></div>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
      </form>
      <template #actions><button class="button secondary" type="button" :disabled="saving" @click="requestDialogClose">取消</button><button class="button primary" type="submit" form="knowledge-form" :disabled="saving">{{ saving ? '保存中…' : '保存知识' }}</button></template>
    </AppDialog>

    <AppDialog :open="dialog === 'environment'" :title="editingId ? '编辑环境' : '添加环境'" overline="ENVIRONMENT ASSET" :busy="saving" @request-close="requestDialogClose">
      <form id="environment-form" @submit.prevent="saveEnvironment">
        <p class="dialog-intro">登记可访问的环境地址和账号标识。密码、Token 与私钥仍由 CI/CD 或目标基础设施管理。</p>
        <div class="field"><label for="environment-type">环境类型</label><select id="environment-type" v-model="environmentForm.type" required><option v-for="option in environmentTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div>
        <div class="field"><label for="environment-address">环境地址</label><input id="environment-address" v-model="environmentForm.address" required autofocus type="url" placeholder="https://dev.example.com" /><small>仅支持 HTTP 或 HTTPS 地址，地址中不能包含账号密码。</small></div>
        <div class="field"><span class="field-label">账号</span><div class="account-list"><div v-for="(_, index) in environmentForm.accounts" :key="index" class="account-row"><input v-model="environmentForm.accounts[index]" required maxlength="100" :aria-label="`账号 ${index + 1}`" :placeholder="`账号 ${index + 1}`" /><button class="text-button danger" type="button" @click="removeEnvironmentAccount(index)">移除</button></div><button class="text-button add-account" type="button" :disabled="environmentForm.accounts.length >= 20" @click="addEnvironmentAccount">＋ 添加账号</button></div><small>最多 20 个账号；这里只保存账号名称，不保存任何登录凭据。</small></div>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
      </form>
      <template #actions><button class="button secondary" type="button" :disabled="saving" @click="requestDialogClose">取消</button><button class="button primary" type="submit" form="environment-form" :disabled="saving">{{ saving ? '保存中…' : '保存环境' }}</button></template>
    </AppDialog>

    <AppDialog :open="dialog === 'member'" :title="editingId ? '编辑成员角色' : '添加项目成员'" overline="PROJECT MEMBER" :busy="saving" @request-close="requestDialogClose">
      <form id="member-form" @submit.prevent="saveMember">
        <p class="dialog-intro">从全局用户中选择项目成员，并定义其在当前项目中的角色。</p>
        <div class="field"><label for="member-user">用户</label><select id="member-user" v-model="memberForm.userId" required autofocus :disabled="Boolean(editingId) || usersStatus === 'pending'"><option v-for="user in selectableUsers" :key="user.id" :value="user.id">{{ user.name }} · {{ user.email }}</option></select><small v-if="editingId">成员身份不可更换，只能修改项目角色。</small><small v-else-if="usersStatus === 'pending'">正在读取全局用户…</small><small v-else-if="usersError">全局用户读取失败，请稍后重试。</small><small v-else-if="!selectableUsers.length">没有可添加的用户，请先前往 <NuxtLink to="/users">用户管理</NuxtLink> 新增用户。</small></div>
        <div class="field"><label for="member-role">项目角色</label><input id="member-role" v-model="memberForm.role" required placeholder="例如：技术负责人" /><small>角色只在当前项目内生效。</small></div>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
      </form>
      <template #actions><button class="button secondary" type="button" :disabled="saving" @click="requestDialogClose">取消</button><button class="button primary" type="submit" form="member-form" :disabled="saving || !memberForm.userId">{{ saving ? '保存中…' : editingId ? '保存角色' : '添加成员' }}</button></template>
    </AppDialog>

    <AppConfirmDialog :open="Boolean(confirmation)" :title="confirmation?.title || ''" :description="confirmation?.description || ''" :confirm-label="confirmation?.confirmLabel || '确认'" :busy="confirmationBusy" danger @cancel="cancelConfirmation" @confirm="runConfirmation" />
  </div>
</template>

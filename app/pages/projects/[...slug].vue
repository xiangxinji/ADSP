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
const dialog = ref<'requirement' | 'statuses' | 'repository' | 'member' | 'environment' | 'knowledge' | null>(null)
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
const knowledgeReferenceOptions = computed(() => [
  ...(workspace.value?.repositories || []).map(repository => ({ assetType: '代码仓库', recordId: repository.id, label: repository.name })),
  ...(workspace.value?.members || []).map(member => ({ assetType: '项目成员', recordId: member.id, label: member.user.name })),
  ...(workspace.value?.environments || []).map(environment => ({ assetType: '环境', recordId: environment.id, label: environment.address })),
  ...(workspace.value?.knowledge || [])
    .filter(knowledge => knowledge.id !== editingId.value)
    .map(knowledge => ({ assetType: '知识', recordId: knowledge.id, label: knowledge.title })),
])

const openRequirement = (requirement?: Requirement) => {
  editingId.value = requirement?.id || null
  Object.assign(requirementForm, requirement ? {
    title: requirement.title,
    description: requirement.description,
    acceptanceCriteria: requirement.acceptanceCriteria,
    statusId: requirement.statusId,
    priority: requirement.priority,
    repositoryIds: [...requirement.repositoryIds],
    memberIds: [...requirement.memberIds],
  } : {
    title: '',
    description: '',
    acceptanceCriteria: '',
    statusId: workspace.value?.requirementStatuses.find(status => status.isInitial)?.id || workspace.value?.requirementStatuses[0]?.id || '',
    priority: 'medium',
    repositoryIds: [],
    memberIds: [],
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
    provider: repository.provider, externalId: repository.externalId, name: repository.name, note: repository.note, url: repository.url, defaultBranch: repository.defaultBranch,
  } : { provider: 'gitlab', externalId: null, name: '', note: '', url: '', defaultBranch: 'main' })
  gitlabRepositories.value = []
  gitlabRepositorySearch.value = ''
  gitlabRepositoryError.value = ''
  actionError.value = ''
  dialog.value = 'repository'
  if (!repository) void loadGitLabRepositories()
}

const openMember = (member?: ProjectMember) => {
  editingId.value = member?.id || null
  Object.assign(memberForm, member
    ? { userId: member.userId, role: member.role }
    : { userId: selectableUsers.value[0]?.id || '', role: '项目成员' })
  actionError.value = ''
  dialog.value = 'member'
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
}

const openKnowledge = (knowledge?: KnowledgeAsset) => {
  editingId.value = knowledge?.id || null
  Object.assign(knowledgeForm, knowledge
    ? { title: knowledge.title, content: knowledge.content }
    : { title: '', content: '' })
  actionError.value = ''
  dialog.value = 'knowledge'
}

const insertKnowledgeReference = (assetType: string, recordId: string) => {
  const separator = knowledgeForm.content && !knowledgeForm.content.endsWith('\n') ? '\n' : ''
  knowledgeForm.content += `${separator}[[${assetType}：${recordId}]]`
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
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

const saveKnowledge = async () => {
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(editingId.value ? `/api/knowledge/${editingId.value}` : `/api/projects/${projectId.value}/knowledge`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: knowledgeForm,
    })
    await refresh()
    closeDialog()
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

const removeRecord = async (kind: 'requirement' | 'repository' | 'member' | 'environment' | 'knowledge', id: string, label: string, referenceCount = 0) => {
  const referenceNote = referenceCount ? `，并从 ${referenceCount} 条需求中移除引用` : ''
  if (!window.confirm(`确定删除“${label}”${referenceNote}吗？`)) return
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
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  }
}
</script>

<template>
  <div class="app-frame">
    <header class="site-header">
      <NuxtLink to="/" class="brand"><span>ForgePilot</span><small>铸航 · Autonomous Software Delivery</small></NuxtLink>
      <nav class="header-nav" aria-label="全局导航"><NuxtLink to="/" class="active">项目</NuxtLink><NuxtLink to="/users">用户管理</NuxtLink><NuxtLink to="/settings">全局设置</NuxtLink></nav>
    </header>

    <main v-if="workspace" class="page workspace-page">
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
        <div class="workspace-stats"><span><strong>{{ workspace.requirements.length }}</strong>需求</span><span><strong>{{ workspace.repositories.length }}</strong>仓库</span><span><strong>{{ workspace.members.length }}</strong>成员</span><span><strong>{{ workspace.environments.length }}</strong>环境</span><span><strong>{{ workspace.knowledge.length }}</strong>知识</span></div>
      </section>

      <nav class="tabs" aria-label="项目模块">
        <NuxtLink :to="projectPath" :class="{ active: activeTab === 'requirements' }" :aria-current="activeTab === 'requirements' ? 'page' : undefined">需求</NuxtLink>
        <NuxtLink :to="assetsPath" :class="{ active: activeTab === 'assets' }" :aria-current="activeTab === 'assets' ? 'page' : undefined">资产</NuxtLink>
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
                <span v-for="member in requirement.members" :key="member.id" class="chip member-chip">{{ member.user.name }}</span>
                <span v-if="!requirement.repositories.length && !requirement.members.length" class="unbound">尚未引用资产</span>
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
              <span class="asset-module-icon repository-icon" aria-hidden="true">⌘</span>
              <span class="asset-module-copy"><strong>代码仓库</strong><small>管理 GitLab、GitHub 仓库连接与默认分支</small></span>
              <span class="asset-module-meta"><strong>{{ workspace.repositories.length }}</strong><small>个仓库</small></span>
              <span class="asset-module-link">进入管理 <span aria-hidden="true">→</span></span>
            </NuxtLink>

            <NuxtLink class="panel asset-module-card" :to="`${assetsPath}/members`">
              <span class="asset-module-icon member-icon" aria-hidden="true">人</span>
              <span class="asset-module-copy"><strong>项目成员</strong><small>从全局用户中选择成员并设置项目角色</small></span>
              <span class="asset-module-meta"><strong>{{ workspace.members.length }}</strong><small>位成员</small></span>
              <span class="asset-module-link">进入管理 <span aria-hidden="true">→</span></span>
            </NuxtLink>

            <NuxtLink class="panel asset-module-card" :to="`${assetsPath}/environments`">
              <span class="asset-module-icon environment-icon" aria-hidden="true">◎</span>
              <span class="asset-module-copy"><strong>环境管理</strong><small>维护开发、测试和生产环境的访问入口</small></span>
              <span class="asset-module-meta"><strong>{{ workspace.environments.length }}</strong><small>个环境</small></span>
              <span class="asset-module-link">进入管理 <span aria-hidden="true">→</span></span>
            </NuxtLink>

            <NuxtLink class="panel asset-module-card" :to="`${assetsPath}/knowledge`">
              <span class="asset-module-icon knowledge-icon" aria-hidden="true">文</span>
              <span class="asset-module-copy"><strong>知识</strong><small>用 Markdown 沉淀项目知识，并引用项目内其他资产</small></span>
              <span class="asset-module-meta"><strong>{{ workspace.knowledge.length }}</strong><small>篇文档</small></span>
              <span class="asset-module-link">进入管理 <span aria-hidden="true">→</span></span>
            </NuxtLink>
          </div>

          <aside class="asset-security-note">
            <span aria-hidden="true">✓</span>
            <p><strong>凭据始终由交付系统保管</strong>ForgePilot 只记录资产标识与访问地址，不保存密码、Token 或私钥。</p>
          </aside>
        </template>

        <template v-else-if="activeAssetModule === 'repositories'">
          <div class="asset-detail-heading">
            <div class="section-heading"><div><p class="overline">REPOSITORY ASSETS</p><h2>代码仓库</h2><p>管理项目引用的源代码仓库和默认分支。</p></div><button class="button primary" type="button" @click="openRepository()">添加仓库</button></div>
          </div>
          <div v-if="workspace.repositories.length" class="asset-record-list">
            <article v-for="repository in workspace.repositories" :id="`asset-${repository.id}`" :key="repository.id" class="panel asset-card asset-record-card">
              <div class="asset-icon repository-icon">⌘</div>
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
              <div class="asset-icon environment-icon">◎</div>
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
              <div class="asset-icon knowledge-icon">文</div>
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

    <main v-else class="page"><div v-if="status === 'pending'" class="panel empty-state">正在读取项目…</div><div v-else class="panel empty-state error-state">{{ error?.statusMessage || '项目不存在' }}</div></main>

    <Teleport to="body">
      <div v-if="dialog" class="dialog-backdrop" @click.self="closeDialog">
        <form v-if="dialog === 'requirement'" class="dialog large" @submit.prevent="saveRequirement">
          <div class="dialog-heading"><div><p class="overline">REQUIREMENT</p><h2>{{ editingId ? '编辑需求' : '新建需求' }}</h2></div><button type="button" class="close-button" @click="closeDialog">×</button></div>
          <div class="form-grid two"><div class="field span-two"><label>标题</label><input v-model="requirementForm.title" required placeholder="描述要交付的功能" /></div><div class="field"><label>状态</label><select v-model="requirementForm.statusId" required><option v-for="requirementStatus in workspace?.requirementStatuses" :key="requirementStatus.id" :value="requirementStatus.id">{{ requirementStatus.name }}</option></select></div><div class="field"><label>优先级</label><select v-model="requirementForm.priority"><option v-for="option in priorityOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div><div class="field span-two"><label>需求说明</label><textarea v-model="requirementForm.description" rows="3" placeholder="说明背景、目标和范围" /></div><div class="field span-two"><label>验收标准</label><textarea v-model="requirementForm.acceptanceCriteria" rows="3" placeholder="说明怎样才算完成" /></div></div>
          <div class="reference-picker"><div><h3>引用代码仓库</h3><p>可以选择多个仓库</p></div><div v-if="workspace?.repositories.length" class="check-list"><label v-for="repository in workspace.repositories" :key="repository.id"><input v-model="requirementForm.repositoryIds" type="checkbox" :value="repository.id" /><span><strong>{{ repository.name }}</strong><small>{{ repositoryProviderLabel(repository.provider) }} · {{ repository.defaultBranch }}<template v-if="repository.note"> · {{ repository.note }}</template></small></span></label></div><p v-else class="picker-empty">请先在资产模块添加代码仓库。</p></div>
          <div class="reference-picker"><div><h3>引用项目成员</h3><p>可以选择多位参与者</p></div><div v-if="workspace?.members.length" class="check-list"><label v-for="member in workspace.members" :key="member.id"><input v-model="requirementForm.memberIds" type="checkbox" :value="member.id" /><span><strong>{{ member.user.name }}</strong><small>{{ member.role || member.user.email }}</small></span></label></div><p v-else class="picker-empty">请先在资产模块添加成员。</p></div>
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
          <div class="field"><label>代码托管平台</label><select v-model="repositoryForm.provider" required><option v-for="option in repositoryProviderOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div><div class="field"><label>仓库名称</label><input v-model="repositoryForm.name" required placeholder="例如：forgepilot-web" /></div><div class="field"><label>备注</label><textarea v-model="repositoryForm.note" maxlength="500" placeholder="例如：前端主仓库，负责 ForgePilot 控制台"></textarea><small>可填写仓库用途、维护范围或其他说明。</small></div><div class="field"><label>{{ repositoryProviderLabel(repositoryForm.provider) }} 仓库地址</label><input v-model="repositoryForm.url" required type="url" :placeholder="repositoryUrlPlaceholder" @input="repositoryForm.externalId = null" /></div><div class="field"><label>默认分支</label><input v-model="repositoryForm.defaultBranch" required placeholder="main" /></div>
          <p v-if="actionError" class="form-error">{{ actionError }}</p><div class="dialog-actions"><button class="button secondary" type="button" @click="closeDialog">取消</button><button class="button primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存仓库' }}</button></div>
        </form>

        <form v-else-if="dialog === 'knowledge'" class="dialog large knowledge-dialog" @submit.prevent="saveKnowledge">
          <div class="dialog-heading"><div><p class="overline">KNOWLEDGE ASSET</p><h2>{{ editingId ? '编辑知识' : '添加知识' }}</h2></div><button type="button" class="close-button" @click="closeDialog">×</button></div>
          <p class="dialog-intro">正文以 Markdown 原文保存。使用 <code>[[资产类型：记录id]]</code> 引用当前项目内的代码仓库、项目成员、环境或其他知识。</p>
          <div class="field"><label>标题</label><input v-model="knowledgeForm.title" required placeholder="例如：项目架构约定" /></div>
          <div class="field"><label>Markdown 内容</label><textarea v-model="knowledgeForm.content" class="knowledge-editor" required rows="16" placeholder="# 项目架构约定&#10;&#10;相关仓库：[[代码仓库：记录id]]" /><small>Markdown 内容会保持原文存入数据库；无法解析的资产引用会在列表中明确标记。</small></div>
          <div v-if="knowledgeReferenceOptions.length" class="knowledge-reference-picker"><strong>插入资产引用</strong><small>选择后会把引用语法追加到正文。</small><div><button v-for="option in knowledgeReferenceOptions" :key="`${option.assetType}:${option.recordId}`" type="button" @click="insertKnowledgeReference(option.assetType, option.recordId)"><span>{{ option.assetType }}</span>{{ option.label }}</button></div></div>
          <p v-if="actionError" class="form-error">{{ actionError }}</p><div class="dialog-actions"><button class="button secondary" type="button" @click="closeDialog">取消</button><button class="button primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存知识' }}</button></div>
        </form>

        <form v-else-if="dialog === 'environment'" class="dialog" @submit.prevent="saveEnvironment">
          <div class="dialog-heading"><div><p class="overline">ENVIRONMENT ASSET</p><h2>{{ editingId ? '编辑环境' : '添加环境' }}</h2></div><button type="button" class="close-button" @click="closeDialog">×</button></div>
          <p class="dialog-intro">登记可访问的环境地址和账号标识。密码、Token 与私钥仍由 CI/CD 或目标基础设施管理。</p>
          <div class="field"><label>环境类型</label><select v-model="environmentForm.type" required><option v-for="option in environmentTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div>
          <div class="field"><label>环境地址</label><input v-model="environmentForm.address" required type="url" placeholder="https://dev.example.com" /><small>仅支持 HTTP 或 HTTPS 地址，地址中不能包含账号密码。</small></div>
          <div class="field"><label>账号</label><div class="account-list"><div v-for="(_, index) in environmentForm.accounts" :key="index" class="account-row"><input v-model="environmentForm.accounts[index]" required maxlength="100" :placeholder="`账号 ${index + 1}`" /><button class="text-button danger" type="button" @click="removeEnvironmentAccount(index)">移除</button></div><button class="text-button add-account" type="button" :disabled="environmentForm.accounts.length >= 20" @click="addEnvironmentAccount">＋ 添加账号</button></div><small>最多 20 个账号；这里只保存账号名称，不保存任何登录凭据。</small></div>
          <p v-if="actionError" class="form-error">{{ actionError }}</p><div class="dialog-actions"><button class="button secondary" type="button" @click="closeDialog">取消</button><button class="button primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存环境' }}</button></div>
        </form>

        <form v-else-if="dialog === 'member'" class="dialog" @submit.prevent="saveMember">
          <div class="dialog-heading"><div><p class="overline">PROJECT MEMBER</p><h2>{{ editingId ? '编辑成员角色' : '添加项目成员' }}</h2></div><button type="button" class="close-button" @click="closeDialog">×</button></div>
          <p class="dialog-intro">从全局用户中选择项目成员，并定义其在当前项目中的角色。</p>
          <div class="field"><label>用户</label><select v-model="memberForm.userId" required :disabled="Boolean(editingId) || usersStatus === 'pending'"><option v-for="user in selectableUsers" :key="user.id" :value="user.id">{{ user.name }} · {{ user.email }}</option></select><small v-if="editingId">成员身份不可更换，只能修改项目角色。</small><small v-else-if="usersStatus === 'pending'">正在读取全局用户…</small><small v-else-if="usersError">全局用户读取失败，请稍后重试。</small><small v-else-if="!selectableUsers.length">没有可添加的用户，请先前往 <NuxtLink to="/users">用户管理</NuxtLink> 新增用户。</small></div>
          <div class="field"><label>项目角色</label><input v-model="memberForm.role" required placeholder="例如：技术负责人" /><small>角色只在当前项目内生效。</small></div>
          <p v-if="actionError" class="form-error">{{ actionError }}</p><div class="dialog-actions"><button class="button secondary" type="button" @click="closeDialog">取消</button><button class="button primary" type="submit" :disabled="saving || !memberForm.userId">{{ saving ? '保存中…' : editingId ? '保存角色' : '添加成员' }}</button></div>
        </form>
      </div>
    </Teleport>
  </div>
</template>

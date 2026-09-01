<script setup lang="ts">
import type { GitLabIdentity, GitLabRepositoryPage, GitLabSettings, LocalWorkspaceSettings } from '#shared/types/asdp'

const { data: settings, status, error, refresh } = await useFetch<GitLabSettings>('/api/settings/gitlab')
const {
  data: workspaceSettings,
  status: workspaceStatus,
  error: workspaceError,
  refresh: refreshWorkspace,
} = await useFetch<LocalWorkspaceSettings>('/api/settings/workspace')
const form = reactive({
  baseUrl: settings.value?.baseUrl || 'https://gitlab.com',
  token: '',
})
const workspaceForm = reactive({ path: workspaceSettings.value?.path || '' })
const saving = ref(false)
const workspaceSaving = ref(false)
const testing = ref(false)
const removing = ref(false)
const showRemoveConfirm = ref(false)
const showToken = ref(false)
const actionError = ref('')
const successMessage = ref('')
const workspaceActionError = ref('')
const workspaceSuccessMessage = ref('')
const testedIdentity = ref<GitLabIdentity | null>(null)
const repositories = ref<GitLabRepositoryPage | null>(null)
const repositoriesLoading = ref(false)
const repositoryError = ref('')
const repositorySearch = ref('')
const { success } = useAppToast()

const pagePending = computed(() => status.value === 'pending' || workspaceStatus.value === 'pending')
const pageError = computed(() => error.value?.statusMessage || workspaceError.value?.statusMessage || '')

const errorMessage = (requestError: any) => requestError?.data?.statusMessage || requestError?.message || '操作失败'
const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '尚未验证'

const refreshAllSettings = async () => {
  await Promise.all([refresh(), refreshWorkspace()])
}

const saveLocalWorkspaceSettings = async () => {
  workspaceSaving.value = true
  workspaceActionError.value = ''
  workspaceSuccessMessage.value = ''
  try {
    const saved = await $fetch<LocalWorkspaceSettings>('/api/settings/workspace', {
      method: 'PUT',
      body: workspaceForm,
    })
    await refreshWorkspace()
    workspaceForm.path = saved.path || workspaceForm.path
    workspaceSuccessMessage.value = '本地工作空间已保存，目录可正常读写'
    success(workspaceSuccessMessage.value)
  } catch (requestError) {
    workspaceActionError.value = errorMessage(requestError)
  } finally {
    workspaceSaving.value = false
  }
}

const testConnection = async () => {
  testing.value = true
  actionError.value = ''
  successMessage.value = ''
  testedIdentity.value = null
  try {
    testedIdentity.value = await $fetch<GitLabIdentity>('/api/settings/gitlab/test', {
      method: 'POST',
      body: form,
    })
    successMessage.value = `连接成功：${testedIdentity.value.name} (@${testedIdentity.value.username})`
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    testing.value = false
  }
}

const loadRepositories = async () => {
  repositoriesLoading.value = true
  repositoryError.value = ''
  try {
    repositories.value = await $fetch<GitLabRepositoryPage>('/api/integrations/gitlab/repositories', {
      query: { search: repositorySearch.value, perPage: 12 },
    })
  } catch (requestError) {
    repositoryError.value = errorMessage(requestError)
  } finally {
    repositoriesLoading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  actionError.value = ''
  successMessage.value = ''
  try {
    await $fetch('/api/settings/gitlab', { method: 'PUT', body: form })
    form.token = ''
    testedIdentity.value = null
    await refresh()
    form.baseUrl = settings.value?.baseUrl || form.baseUrl
    successMessage.value = 'GitLab 全局配置已保存并验证'
    await loadRepositories()
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

const removeSettings = async () => {
  removing.value = true
  actionError.value = ''
  successMessage.value = ''
  try {
    await $fetch('/api/settings/gitlab', { method: 'DELETE' })
    form.token = ''
    repositories.value = null
    await refresh()
    successMessage.value = 'GitLab 全局配置已移除'
    success(successMessage.value)
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    removing.value = false
    showRemoveConfirm.value = false
  }
}

onMounted(() => {
  if (settings.value?.configured) void loadRepositories()
})
</script>

<template>
  <div class="app-frame">
    <AppHeader />

    <main id="main-content" class="page settings-page">
      <section class="page-title-row">
        <div><p class="overline">GLOBAL SETTINGS</p><h1>全局设置</h1><p>管理 ForgePilot 的本地工作目录和外部系统连接。</p></div>
      </section>

      <AppAsyncState v-if="pagePending || pageError" :pending="pagePending" :error-message="pageError" @retry="refreshAllSettings" />

      <div v-else class="settings-layout">
        <section>
          <div class="settings-section-heading"><div><p class="overline">LOCAL WORKSPACE</p><h2>本地工作空间</h2><p>仓库检出、任务文件和后续所有业务文件操作都限定在这个目录中。</p></div><span class="connection-state" :class="{ connected: workspaceSettings?.configured }">{{ workspaceSettings?.configured ? '已就绪' : '未配置' }}</span></div>

          <form class="panel integration-form" @submit.prevent="saveLocalWorkspaceSettings">
            <AppFormField field-id="workspace-path" label="工作空间目录">
              <AppInput id="workspace-path" v-model="workspaceForm.path" required autocomplete="off" spellcheck="false" placeholder="例如 C:\ForgePilot\workspaces" />
              <template #hint>填写运行 ForgePilot 这台电脑上的绝对路径。目录不存在时会自动创建，并检查是否可读写。</template>
            </AppFormField>
            <div v-if="workspaceSettings?.configured" class="connection-summary workspace-summary"><div><span>当前生效目录</span><strong>{{ workspaceSettings.path }}</strong></div><div><span>最近更新</span><strong>{{ formatDate(workspaceSettings.updatedAt) }}</strong></div></div>
            <p v-if="workspaceSuccessMessage" class="form-success" role="status">{{ workspaceSuccessMessage }}</p>
            <p v-if="workspaceActionError" class="form-error" role="alert">{{ workspaceActionError }}</p>
            <div class="settings-actions single-action"><AppButton type="submit" icon="save" :busy="workspaceSaving" busy-label="检查中…">保存并检查目录</AppButton></div>
          </form>
        </section>

        <aside class="panel security-note workspace-note"><div class="security-icon"><AppIcon name="environment" :size="20" /></div><h3>统一目录边界</h3><p>保存后，ForgePilot 会把仓库副本、任务过程文件和生成物统一放在该目录下，避免文件散落到其他位置。</p><ul><li>只能配置绝对路径</li><li>业务路径不能越过此目录</li><li>数据库和加密密钥不随目录迁移</li></ul></aside>
      </div>

      <div v-if="!pagePending && !pageError" class="settings-layout">
        <section>
          <div class="settings-section-heading"><div><p class="overline">SOURCE CONTROL</p><h2>GitLab</h2><p>用于验证身份、读取可访问仓库，并为项目登记仓库资产。</p></div><span class="connection-state" :class="{ connected: settings?.configured }">{{ settings?.configured ? '已连接' : '未配置' }}</span></div>

          <form class="panel integration-form" @submit.prevent="saveSettings">
            <AppFormField field-id="gitlab-url" label="GitLab 地址" hint="支持 GitLab.com 和企业自托管地址。"><AppInput id="gitlab-url" v-model="form.baseUrl" required type="url" placeholder="https://gitlab.com" /></AppFormField>
            <AppFormField field-id="gitlab-token" label="Access Token">
              <div class="secret-input"><AppInput id="gitlab-token" v-model="form.token" :required="!settings?.configured" :type="showToken ? 'text' : 'password'" autocomplete="new-password" spellcheck="false" :placeholder="settings?.configured ? `已保存 ${settings.tokenHint}，留空则保持不变` : '输入 GitLab Personal Access Token'" /><AppButton variant="plain" :icon="showToken ? 'eye-off' : 'eye'" @click="showToken = !showToken">{{ showToken ? '隐藏' : '显示' }}</AppButton></div>
              <template #hint>Token 只发送到 ForgePilot 服务端，并以加密形式保存。仓库读取至少需要 <code>read_api</code> 权限，克隆私有仓库还需要 <code>read_repository</code> 权限。</template>
            </AppFormField>

            <div v-if="settings?.configured" class="connection-summary"><div><span>连接身份</span><strong>{{ settings.connectedUser?.name || 'GitLab 用户' }} <small v-if="settings.connectedUser">@{{ settings.connectedUser.username }}</small></strong></div><div><span>上次验证</span><strong>{{ formatDate(settings.verifiedAt) }}</strong></div></div>
            <p v-if="successMessage" class="form-success" role="status">{{ successMessage }}</p>
            <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
            <div class="settings-actions"><AppButton v-if="settings?.configured" variant="danger-outline" icon="delete" :busy="removing" busy-label="移除中…" @click="showRemoveConfirm = true">移除配置</AppButton><span /><AppButton variant="secondary" icon="refresh" :busy="testing" busy-label="测试中…" :disabled="saving" @click="testConnection">测试连接</AppButton><AppButton type="submit" icon="save" :busy="saving" busy-label="保存中…" :disabled="testing">保存并验证</AppButton></div>
          </form>
        </section>

        <aside class="panel security-note"><div class="security-icon"><AppIcon name="shield-check" :size="20" /></div><h3>凭据保护</h3><p>Access Token 不会出现在读取接口、页面数据或仓库记录中。ForgePilot 使用独立密钥加密保存，并只在服务端调用 GitLab 时解密。</p><ul><li>优先使用专用、可撤销的 Token</li><li>按实际操作授予最小权限</li><li>定期轮换并在 GitLab 中设置过期时间</li></ul></aside>
      </div>

      <section v-if="settings?.configured" class="repository-browser">
        <div class="section-heading"><div><h2>可访问仓库</h2><p>验证当前 Token 能够读取的 GitLab 项目；登记操作请进入具体 ForgePilot 项目的资产模块。</p></div><div class="repository-search"><label class="sr-only" for="repository-search">搜索仓库</label><AppInput id="repository-search" v-model="repositorySearch" placeholder="搜索仓库" @keydown.enter.prevent="loadRepositories" /><AppButton variant="secondary" icon="search" :busy="repositoriesLoading" busy-label="读取中…" @click="loadRepositories">查询</AppButton></div></div>
        <p v-if="repositoryError" class="alert error-state" role="alert">{{ repositoryError }}</p>
        <div v-if="repositories?.items.length" class="remote-repository-grid">
          <a v-for="repository in repositories.items" :key="repository.id" class="panel remote-repository-card" :href="repository.webUrl" target="_blank" rel="noreferrer"><div><strong>{{ repository.name }}</strong><span>{{ repository.nameWithNamespace }}</span></div><small>{{ repository.visibility }} · {{ repository.defaultBranch }}</small></a>
        </div>
        <div v-else-if="!repositoriesLoading" class="panel empty-state compact">{{ repositorySearch ? '没有匹配的仓库' : '当前 Token 没有可访问的仓库' }}</div>
      </section>
    </main>
    <AppConfirmDialog :open="showRemoveConfirm" title="移除 GitLab 全局配置？" description="项目中已登记的仓库不会被删除，但在重新配置前将无法读取 GitLab 仓库。" confirm-label="移除配置" :busy="removing" danger @cancel="showRemoveConfirm = false" @confirm="removeSettings" />
  </div>
</template>

<script setup lang="ts">
import type { GitLabIdentity, GitLabRepositoryPage, GitLabSettings } from '#shared/types/asdp'

const { data: settings, status, error, refresh } = await useFetch<GitLabSettings>('/api/settings/gitlab')
const form = reactive({
  baseUrl: settings.value?.baseUrl || 'https://gitlab.com',
  token: '',
})
const saving = ref(false)
const testing = ref(false)
const removing = ref(false)
const showToken = ref(false)
const actionError = ref('')
const successMessage = ref('')
const testedIdentity = ref<GitLabIdentity | null>(null)
const repositories = ref<GitLabRepositoryPage | null>(null)
const repositoriesLoading = ref(false)
const repositoryError = ref('')
const repositorySearch = ref('')

const errorMessage = (requestError: any) => requestError?.data?.statusMessage || requestError?.message || '操作失败'
const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '尚未验证'

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
  if (!window.confirm('确定移除 GitLab 全局配置吗？项目中已登记的仓库不会被删除。')) return
  removing.value = true
  actionError.value = ''
  successMessage.value = ''
  try {
    await $fetch('/api/settings/gitlab', { method: 'DELETE' })
    form.token = ''
    repositories.value = null
    await refresh()
    successMessage.value = 'GitLab 全局配置已移除'
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    removing.value = false
  }
}

onMounted(() => {
  if (settings.value?.configured) void loadRepositories()
})
</script>

<template>
  <div class="app-frame">
    <header class="site-header">
      <NuxtLink to="/" class="brand"><span>ASDP</span><small>Autonomous Software Delivery Platform</small></NuxtLink>
      <nav class="header-nav" aria-label="全局导航"><NuxtLink to="/">项目</NuxtLink><NuxtLink to="/users">用户管理</NuxtLink><NuxtLink to="/settings" class="active">全局设置</NuxtLink></nav>
    </header>

    <main class="page settings-page">
      <section class="page-title-row">
        <div><p class="overline">GLOBAL SETTINGS</p><h1>全局设置</h1><p>管理 ASDP 调用外部交付系统所需的连接凭据。</p></div>
      </section>

      <div v-if="status === 'pending'" class="panel empty-state">正在读取配置…</div>
      <div v-else-if="error" class="panel empty-state error-state">无法读取配置：{{ error.statusMessage }}</div>

      <div v-else class="settings-layout">
        <section>
          <div class="settings-section-heading"><div><p class="overline">SOURCE CONTROL</p><h2>GitLab</h2><p>用于验证身份、读取可访问仓库，并为项目登记仓库资产。</p></div><span class="connection-state" :class="{ connected: settings?.configured }">{{ settings?.configured ? '已连接' : '未配置' }}</span></div>

          <form class="panel integration-form" @submit.prevent="saveSettings">
            <div class="field"><label for="gitlab-url">GitLab 地址</label><input id="gitlab-url" v-model="form.baseUrl" required type="url" placeholder="https://gitlab.com" /><small>支持 GitLab.com 和企业自托管地址。</small></div>
            <div class="field"><label for="gitlab-token">Access Token</label><div class="secret-input"><input id="gitlab-token" v-model="form.token" :required="!settings?.configured" :type="showToken ? 'text' : 'password'" autocomplete="new-password" spellcheck="false" :placeholder="settings?.configured ? `已保存 ${settings.tokenHint}，留空则保持不变` : '输入 GitLab Personal Access Token'" /><button type="button" @click="showToken = !showToken">{{ showToken ? '隐藏' : '显示' }}</button></div><small>Token 只发送到 ASDP 服务端，并以加密形式保存。仓库读取至少需要 <code>read_api</code> 权限。</small></div>

            <div v-if="settings?.configured" class="connection-summary"><div><span>连接身份</span><strong>{{ settings.connectedUser?.name || 'GitLab 用户' }} <small v-if="settings.connectedUser">@{{ settings.connectedUser.username }}</small></strong></div><div><span>上次验证</span><strong>{{ formatDate(settings.verifiedAt) }}</strong></div></div>
            <p v-if="successMessage" class="form-success">{{ successMessage }}</p>
            <p v-if="actionError" class="form-error">{{ actionError }}</p>
            <div class="settings-actions"><button v-if="settings?.configured" class="button danger-outline" type="button" :disabled="removing" @click="removeSettings">{{ removing ? '移除中…' : '移除配置' }}</button><span /><button class="button secondary" type="button" :disabled="testing || saving" @click="testConnection">{{ testing ? '测试中…' : '测试连接' }}</button><button class="button primary" type="submit" :disabled="saving || testing">{{ saving ? '保存中…' : '保存并验证' }}</button></div>
          </form>
        </section>

        <aside class="panel security-note"><div class="security-icon">✓</div><h3>凭据保护</h3><p>Access Token 不会出现在读取接口、页面数据或仓库记录中。ASDP 使用独立密钥加密保存，并只在服务端调用 GitLab 时解密。</p><ul><li>优先使用专用、可撤销的 Token</li><li>按实际操作授予最小权限</li><li>定期轮换并在 GitLab 中设置过期时间</li></ul></aside>
      </div>

      <section v-if="settings?.configured" class="repository-browser">
        <div class="section-heading"><div><h2>可访问仓库</h2><p>验证当前 Token 能够读取的 GitLab 项目；登记操作请进入具体 ASDP 项目的资产模块。</p></div><div class="repository-search"><input v-model="repositorySearch" placeholder="搜索仓库" @keydown.enter.prevent="loadRepositories" /><button class="button secondary" type="button" :disabled="repositoriesLoading" @click="loadRepositories">{{ repositoriesLoading ? '读取中…' : '查询' }}</button></div></div>
        <p v-if="repositoryError" class="alert error-state">{{ repositoryError }}</p>
        <div v-if="repositories?.items.length" class="remote-repository-grid">
          <a v-for="repository in repositories.items" :key="repository.id" class="panel remote-repository-card" :href="repository.webUrl" target="_blank" rel="noreferrer"><div><strong>{{ repository.name }}</strong><span>{{ repository.nameWithNamespace }}</span></div><small>{{ repository.visibility }} · {{ repository.defaultBranch }}</small></a>
        </div>
        <div v-else-if="!repositoriesLoading" class="panel empty-state compact">{{ repositorySearch ? '没有匹配的仓库' : '当前 Token 没有可访问的仓库' }}</div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { ProjectSummary } from '#shared/types/asdp'

const { data: projects, status, error, refresh } = await useFetch<ProjectSummary[]>('/api/projects')
const showCreateForm = ref(false)
const saving = ref(false)
const actionError = ref('')
const form = reactive({ name: '', description: '' })

const createProject = async () => {
  if (!form.name.trim()) return
  saving.value = true
  actionError.value = ''
  try {
    const project = await $fetch<ProjectSummary>('/api/projects', {
      method: 'POST',
      body: { name: form.name, description: form.description },
    })
    await refresh()
    await navigateTo(`/projects/${project.id}`)
  } catch (requestError: any) {
    actionError.value = requestError?.data?.statusMessage || '创建项目失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="app-frame">
    <header class="site-header">
      <NuxtLink to="/" class="brand"><span>ASDP</span><small>Autonomous Software Delivery Platform</small></NuxtLink>
      <nav class="header-nav" aria-label="全局导航"><NuxtLink to="/" class="active">项目</NuxtLink><NuxtLink to="/users">用户管理</NuxtLink><NuxtLink to="/settings">全局设置</NuxtLink></nav>
      <span class="header-badge">Architecture Preview</span>
    </header>

    <main class="page projects-page">
      <section class="page-title-row">
        <div>
          <p class="overline">WORKSPACES</p>
          <h1>项目</h1>
          <p>从项目进入需求、代码仓库和人员上下文。</p>
        </div>
        <button class="button primary" type="button" @click="showCreateForm = !showCreateForm">{{ showCreateForm ? '取消' : '新建项目' }}</button>
      </section>

      <form v-if="showCreateForm" class="panel create-project" @submit.prevent="createProject">
        <div class="field"><label for="project-name">项目名称</label><input id="project-name" v-model="form.name" required placeholder="例如：ASDP Platform" /></div>
        <div class="field grow"><label for="project-description">项目说明</label><input id="project-description" v-model="form.description" placeholder="描述这个项目交付什么" /></div>
        <button class="button primary" type="submit" :disabled="saving">{{ saving ? '创建中…' : '创建并进入' }}</button>
        <p v-if="actionError" class="form-error">{{ actionError }}</p>
      </form>

      <div v-if="status === 'pending'" class="panel empty-state">正在读取项目…</div>
      <div v-else-if="error" class="panel empty-state error-state">无法读取项目：{{ error.statusMessage }}</div>
      <section v-else class="project-list">
        <NuxtLink v-for="project in projects" :key="project.id" :to="`/projects/${project.id}`" class="panel project-card">
          <div class="project-monogram">{{ project.name.slice(0, 2).toUpperCase() }}</div>
          <div class="project-copy"><h2>{{ project.name }}</h2><p>{{ project.description || '暂无项目说明' }}</p></div>
          <div class="project-counts"><span><strong>{{ project.requirementCount }}</strong> 需求</span><span><strong>{{ project.repositoryCount }}</strong> 仓库</span><span><strong>{{ project.personCount }}</strong> 人员</span></div>
          <span class="open-link">进入项目 →</span>
        </NuxtLink>
        <div v-if="!projects?.length" class="panel empty-state"><strong>还没有项目</strong><span>创建第一个项目开始管理需求和资产。</span></div>
      </section>
    </main>
  </div>
</template>

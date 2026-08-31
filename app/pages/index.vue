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
    <AppHeader badge="Architecture Preview" />

    <main id="main-content" class="page projects-page">
      <section class="page-title-row">
        <div>
          <p class="overline">WORKSPACES</p>
          <h1>项目</h1>
          <p>从项目进入需求、代码仓库、成员和环境上下文。</p>
        </div>
        <button class="button primary" type="button" @click="showCreateForm = !showCreateForm">{{ showCreateForm ? '取消' : '新建项目' }}</button>
      </section>

      <form v-if="showCreateForm" class="panel create-project" @submit.prevent="createProject">
        <div class="field"><label for="project-name">项目名称</label><input id="project-name" v-model="form.name" required placeholder="例如：ForgePilot Platform" /></div>
        <div class="field grow"><label for="project-description">项目说明</label><input id="project-description" v-model="form.description" placeholder="描述这个项目交付什么" /></div>
        <button class="button primary" type="submit" :disabled="saving">{{ saving ? '创建中…' : '创建并进入' }}</button>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
      </form>

      <AppAsyncState v-if="status === 'pending' || error" :pending="status === 'pending'" :error-message="error?.statusMessage" @retry="refresh" />
      <section v-else class="project-list">
        <NuxtLink v-for="project in projects" :key="project.id" :to="`/projects/${project.id}`" class="panel project-card">
          <div class="project-monogram">{{ project.name.slice(0, 2).toUpperCase() }}</div>
          <div class="project-copy"><h2>{{ project.name }}</h2><p>{{ project.description || '暂无项目说明' }}</p></div>
          <div class="project-counts"><span><strong>{{ project.requirementCount }}</strong> 需求</span><span><strong>{{ project.repositoryCount }}</strong> 仓库</span><span><strong>{{ project.memberCount }}</strong> 成员</span><span><strong>{{ project.environmentCount }}</strong> 环境</span><span><strong>{{ project.knowledgeCount }}</strong> 知识</span></div>
          <span class="open-link">进入项目 →</span>
        </NuxtLink>
        <div v-if="!projects?.length" class="panel empty-state"><strong>还没有项目</strong><span>创建第一个项目开始管理需求和资产。</span></div>
      </section>
    </main>
  </div>
</template>

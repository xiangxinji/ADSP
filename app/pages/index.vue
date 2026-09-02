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
          <p>从项目进入资产、工作流和需求上下文。</p>
        </div>
        <AppButton :icon="showCreateForm ? 'close' : 'add'" @click="showCreateForm = !showCreateForm">{{ showCreateForm ? '取消' : '新建项目' }}</AppButton>
      </section>

      <form v-if="showCreateForm" class="panel create-project" @submit.prevent="createProject">
        <AppFormField field-id="project-name" label="项目名称"><AppInput id="project-name" v-model="form.name" required placeholder="例如：ForgePilot Platform" /></AppFormField>
        <AppFormField class="grow" field-id="project-description" label="项目说明"><AppInput id="project-description" v-model="form.description" placeholder="描述这个项目交付什么" /></AppFormField>
        <AppButton type="submit" icon="add" :busy="saving" busy-label="创建中…">创建并进入</AppButton>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
      </form>

      <AppAsyncState v-if="status === 'pending' || error" :pending="status === 'pending'" :error-message="error?.statusMessage" @retry="refresh" />
      <section v-else class="project-list">
        <NuxtLink v-for="project in projects" :key="project.id" :to="`/projects/${project.id}`" class="panel project-card">
          <div class="project-monogram">{{ project.name.slice(0, 2).toUpperCase() }}</div>
          <div class="project-copy"><h2>{{ project.name }}</h2><p>{{ project.description || '暂无项目说明' }}</p></div>
          <div class="project-counts"><span><strong>{{ project.requirementCount }}</strong> 需求</span><span><strong>{{ project.workflowCount }}</strong> 工作流</span><span><strong>{{ project.repositoryCount }}</strong> 仓库</span><span><strong>{{ project.memberCount }}</strong> 成员</span><span><strong>{{ project.environmentCount }}</strong> 环境</span><span><strong>{{ project.knowledgeCount }}</strong> 知识</span></div>
          <span class="open-link">进入项目 →</span>
        </NuxtLink>
        <div v-if="!projects?.length" class="panel empty-state"><strong>还没有项目</strong><span>创建第一个项目开始管理需求和资产。</span></div>
      </section>
    </main>
  </div>
</template>

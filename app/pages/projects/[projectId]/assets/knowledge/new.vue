<script setup lang="ts">
import type { KnowledgeAsset, ProjectWorkspace } from '#shared/types/asdp'

const route = useRoute()
const router = useRouter()
const projectId = String(route.params.projectId || '')
const knowledgePath = `/projects/${projectId}/assets/knowledge`
const { data: workspace, status, error, refresh } = await useFetch<ProjectWorkspace>(`/api/projects/${projectId}`)
const title = ref('')
const saving = ref(false)
const actionError = ref('')
const { success } = useAppToast()

const errorMessage = (requestError: any) => requestError?.data?.statusMessage || requestError?.message || '操作失败'

const createKnowledge = async () => {
  saving.value = true
  actionError.value = ''
  try {
    const knowledge = await $fetch<KnowledgeAsset>(`/api/projects/${projectId}/knowledge`, {
      method: 'POST',
      body: { title: title.value, content: '' },
    })
    success('基本信息已保存，可以开始编写正文')
    await router.push(`${knowledgePath}/${knowledge.id}/edit`)
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="app-frame">
    <AppHeader />

    <main v-if="workspace" id="main-content" class="page knowledge-info-page">
      <nav class="breadcrumbs" aria-label="当前位置">
        <NuxtLink to="/">项目</NuxtLink><span aria-hidden="true">/</span>
        <NuxtLink :to="`/projects/${projectId}`">{{ workspace.project.name }}</NuxtLink><span aria-hidden="true">/</span>
        <NuxtLink :to="knowledgePath">知识</NuxtLink><span aria-hidden="true">/</span>
        <span aria-current="page">添加知识</span>
      </nav>

      <section class="knowledge-info-heading">
        <div><p class="overline">KNOWLEDGE ASSET</p><h1>添加知识</h1><p>先填写基本信息，创建后将进入独立的 Markdown 编辑页面。</p></div>
      </section>

      <form class="panel knowledge-info-form" @submit.prevent="createKnowledge">
        <AppFormField field-id="knowledge-title" label="知识标题" hint="使用清晰、可检索的标题说明这篇知识的主题。">
          <AppInput id="knowledge-title" v-model="title" required autofocus placeholder="例如：项目架构约定" />
        </AppFormField>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
        <div class="knowledge-info-actions">
          <AppButton variant="secondary" :to="knowledgePath">取消</AppButton>
          <AppButton type="submit" icon="add" :busy="saving" busy-label="创建中…">下一步：编写正文</AppButton>
        </div>
      </form>
    </main>

    <main v-else id="main-content" class="page"><AppAsyncState :pending="status === 'pending'" :error-message="error?.statusMessage || '项目不存在'" @retry="refresh" /></main>
  </div>
</template>

<script setup lang="ts">
import type { ProjectWorkspace } from '#shared/types/asdp'

const route = useRoute()
const router = useRouter()
const projectId = String(route.params.projectId || '')
const knowledgeId = String(route.params.knowledgeId || '')
const knowledgePath = `/projects/${projectId}/assets/knowledge`
const editorPath = `${knowledgePath}/${knowledgeId}/edit`
const { data: workspace, status, error, refresh } = await useFetch<ProjectWorkspace>(`/api/projects/${projectId}`)
const knowledge = computed(() => workspace.value?.knowledge.find(item => item.id === knowledgeId))
const title = ref('')
const saving = ref(false)
const actionError = ref('')
const { success } = useAppToast()

watch(knowledge, (value) => {
  if (value) title.value = value.title
}, { immediate: true })

const errorMessage = (requestError: any) => requestError?.data?.statusMessage || requestError?.message || '操作失败'

const updateKnowledge = async () => {
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/knowledge/${knowledgeId}`, {
      method: 'PATCH',
      body: { title: title.value },
    })
    success('知识基本信息已保存')
    await router.push(knowledgePath)
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

    <main v-if="workspace && knowledge" id="main-content" class="page knowledge-info-page">
      <nav class="breadcrumbs" aria-label="当前位置">
        <NuxtLink to="/">项目</NuxtLink><span aria-hidden="true">/</span>
        <NuxtLink :to="`/projects/${projectId}`">{{ workspace.project.name }}</NuxtLink><span aria-hidden="true">/</span>
        <NuxtLink :to="knowledgePath">知识</NuxtLink><span aria-hidden="true">/</span>
        <span aria-current="page">基本信息</span>
      </nav>

      <section class="knowledge-info-heading">
        <div><p class="overline">KNOWLEDGE ASSET</p><h1>知识基本信息</h1><p>这里只维护知识标题，Markdown 正文在独立的全屏页面中编写。</p></div>
        <AppButton variant="secondary" icon="edit" :to="editorPath">编写正文</AppButton>
      </section>

      <form class="panel knowledge-info-form" @submit.prevent="updateKnowledge">
        <AppFormField field-id="knowledge-title" label="知识标题" hint="使用清晰、可检索的标题说明这篇知识的主题。">
          <AppInput id="knowledge-title" v-model="title" required autofocus placeholder="例如：项目架构约定" />
        </AppFormField>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
        <div class="knowledge-info-actions">
          <AppButton variant="secondary" :to="knowledgePath">取消</AppButton>
          <AppButton type="submit" icon="save" :busy="saving" busy-label="保存中…">保存基本信息</AppButton>
        </div>
      </form>
    </main>

    <main v-else-if="!workspace" id="main-content" class="page"><AppAsyncState :pending="status === 'pending'" :error-message="error?.statusMessage || '项目不存在'" @retry="refresh" /></main>
    <main v-else id="main-content" class="page">
      <section class="panel async-state">
        <span class="async-error-icon"><AppIcon name="alert" :size="20" /></span>
        <strong>知识不存在</strong>
        <span>这篇知识可能已被删除，或不属于当前项目。</span>
        <AppButton variant="secondary" icon="arrow-left" :to="knowledgePath">返回知识列表</AppButton>
      </section>
    </main>
  </div>
</template>

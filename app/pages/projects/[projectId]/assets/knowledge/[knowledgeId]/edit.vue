<script setup lang="ts">
import type { ProjectWorkspace } from '#shared/types/asdp'
import type { KnowledgeAssetReferenceOption } from '~/editor/knowledge-asset-reference'

type KnowledgeMarkdownEditorHandle = {
  getMarkdown: () => string
}

const route = useRoute()
const projectId = String(route.params.projectId || '')
const knowledgeId = String(route.params.knowledgeId || '')
const knowledgePath = `/projects/${projectId}/assets/knowledge`
const infoPath = `${knowledgePath}/${knowledgeId}/info`
const { data: workspace, status, error, refresh } = await useFetch<ProjectWorkspace>(`/api/projects/${projectId}`, {
  key: `knowledge-editor-workspace-${projectId}-${knowledgeId}`,
})
const knowledge = computed(() => workspace.value?.knowledge.find(item => item.id === knowledgeId))
const editor = ref<KnowledgeMarkdownEditorHandle | null>(null)
const content = ref('')
const savedContent = ref('')
const initializedKnowledgeId = ref('')
const saving = ref(false)
const actionError = ref('')
const { success } = useAppToast()

watch(knowledge, (value) => {
  if (!value || initializedKnowledgeId.value === value.id) return
  content.value = value.content
  savedContent.value = value.content
  initializedKnowledgeId.value = value.id
}, { immediate: true })

const referenceOptions = computed<KnowledgeAssetReferenceOption[]>(() => [
  ...(workspace.value?.repositories || []).map(repository => ({
    assetType: '代码仓库',
    targetType: 'repository' as const,
    recordId: repository.id,
    label: repository.name,
    detail: repository.provider === 'gitlab' ? 'GitLab' : 'GitHub',
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
    detail: `${({ development: '开发环境', testing: '测试环境', production: '生产环境' })[environment.type]} · ${environment.accounts.map(account => account.account).join('、')}`,
  })),
  ...(workspace.value?.knowledge || [])
    .filter(item => item.id !== knowledgeId)
    .map(item => ({
      assetType: '知识',
      targetType: 'knowledge' as const,
      recordId: item.id,
      label: item.title,
      detail: 'Markdown 知识',
    })),
])
const editorReferenceKey = computed(() => referenceOptions.value
  .map(option => `${option.targetType}:${option.recordId}:${option.label}:${option.detail}`)
  .join('|'))

const hasUnsavedChanges = computed(() => content.value !== savedContent.value)
const errorMessage = (requestError: any) => requestError?.data?.statusMessage || requestError?.message || '操作失败'

const saveKnowledge = async () => {
  const markdown = editor.value?.getMarkdown() ?? content.value
  saving.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/knowledge/${knowledgeId}`, {
      method: 'PATCH',
      body: { content: markdown },
    })
    content.value = markdown
    savedContent.value = markdown
    success('Markdown 正文已保存')
  } catch (requestError) {
    actionError.value = errorMessage(requestError)
  } finally {
    saving.value = false
  }
}

onBeforeRouteLeave(() => {
  if (hasUnsavedChanges.value && import.meta.client && !window.confirm('正文尚未保存，确定离开当前页面吗？')) return false
})
</script>

<template>
  <main id="main-content" class="knowledge-editor-page">
    <template v-if="workspace && knowledge">
      <header class="knowledge-editor-header">
        <AppButton variant="plain" class="knowledge-editor-back" icon="arrow-left" :to="knowledgePath" aria-label="返回知识列表" />
        <div class="knowledge-editor-title">
          <span>{{ workspace.project.name }} · Markdown</span>
          <strong>{{ knowledge.title }}</strong>
        </div>
        <div class="knowledge-editor-actions">
          <span class="knowledge-save-state" :class="{ saved: !hasUnsavedChanges }">{{ hasUnsavedChanges ? '有未保存修改' : '已保存' }}</span>
          <AppButton variant="secondary" icon="settings" :to="infoPath">基本信息</AppButton>
          <AppButton icon="save" :busy="saving" busy-label="保存中…" @click="saveKnowledge">保存正文</AppButton>
        </div>
      </header>

      <p v-if="actionError" class="knowledge-editor-error" role="alert">{{ actionError }}</p>
      <section class="knowledge-editor-body" aria-label="Markdown 正文编辑区">
        <KnowledgeMarkdownEditor :key="editorReferenceKey" ref="editor" v-model="content" :references="referenceOptions" />
      </section>
    </template>

    <section v-else-if="!workspace" class="knowledge-editor-loading"><AppAsyncState :pending="status === 'pending'" :error-message="error?.statusMessage || '项目不存在'" @retry="refresh" /></section>
    <section v-else class="knowledge-editor-loading">
      <div class="panel async-state">
        <span class="async-error-icon"><AppIcon name="alert" :size="20" /></span>
        <strong>知识不存在</strong>
        <span>这篇知识可能已被删除，或不属于当前项目。</span>
        <AppButton variant="secondary" icon="arrow-left" :to="knowledgePath">返回知识列表</AppButton>
      </div>
    </section>
  </main>
</template>

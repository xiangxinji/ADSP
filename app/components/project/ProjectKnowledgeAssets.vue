<script setup lang="ts">
import { assetOperationsForModule } from '#shared/config/asset-operations'
import type { AssetOperationDefinition } from '#shared/types/asset-operations'
import type { KnowledgeReference, ProjectWorkspace } from '#shared/types/asdp'

type KnowledgeAsset = ProjectWorkspace['knowledge'][number]

const props = defineProps<{
  workspace: ProjectWorkspace
  projectId: string
}>()

const emit = defineEmits<{ refresh: [] }>()
const operations = assetOperationsForModule('knowledge')
const deletingKnowledge = ref<KnowledgeAsset | null>(null)
const deleting = ref(false)
const actionError = ref('')
const { success } = useAppToast()
const assetsPath = computed(() => `/projects/${props.projectId}/assets`)
const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

const referencePath = (reference: KnowledgeReference) => {
  if (!reference.resolved || !reference.targetType) return ''
  const module = { repository: 'repositories', member: 'members', environment: 'environments', knowledge: 'knowledge' }[reference.targetType]
  return `${assetsPath.value}/${module}#asset-${reference.recordId}`
}
const referenceLabel = (reference: KnowledgeReference) => reference.label || `${reference.assetType}：${reference.recordId}`
const referenceWarning = (reference: KnowledgeReference) => missingAssetReferenceMessage(reference.assetType, reference.recordId)
const operationTarget = (knowledgeId: string, operationId: string) => {
  if (operationId === 'knowledge.info') return `${assetsPath.value}/knowledge/${knowledgeId}/info`
  if (operationId === 'knowledge.edit') return `${assetsPath.value}/knowledge/${knowledgeId}/edit`
  return undefined
}
const runOperation = (knowledge: KnowledgeAsset, operation: AssetOperationDefinition) => {
  if (operation.id === 'knowledge.delete') deletingKnowledge.value = knowledge
}

const removeKnowledge = async () => {
  if (!deletingKnowledge.value) return
  const knowledge = deletingKnowledge.value
  deleting.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/knowledge/${knowledge.id}`, { method: 'DELETE' })
    deletingKnowledge.value = null
    emit('refresh')
    success(`“${knowledge.title}”已删除`)
  } catch (error: any) {
    actionError.value = error?.data?.statusMessage || error?.message || '操作失败'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="module-section assets-module">
    <div class="asset-detail-heading">
      <div class="section-heading">
        <div><p class="overline">KNOWLEDGE ASSETS</p><h2>知识</h2><p>先维护知识基本信息，再进入全屏 Markdown 页面编写正文。</p></div>
        <AppButton icon="add" :to="`${assetsPath}/knowledge/new`">添加知识</AppButton>
      </div>
    </div>
    <AssetOperationCatalog :operations="operations" />
    <p v-if="actionError" class="alert error-state" role="alert">{{ actionError }}</p>
    <div v-if="workspace.knowledge.length" class="asset-record-list knowledge-record-list" role="region" aria-label="项目知识列表" tabindex="0">
      <article v-for="knowledge in workspace.knowledge" :id="`asset-${knowledge.id}`" :key="knowledge.id" class="panel asset-card asset-record-card knowledge-card">
        <div class="asset-icon knowledge-icon"><AppIcon name="knowledge" :size="20" /></div>
        <div class="asset-copy knowledge-copy">
          <strong>{{ knowledge.title }}</strong>
          <pre>{{ knowledge.content }}</pre>
          <div v-if="knowledge.references.length" class="knowledge-references">
            <template v-for="reference in knowledge.references" :key="`${reference.assetType}:${reference.recordId}`">
              <NuxtLink v-if="reference.resolved" class="chip knowledge-reference" :to="referencePath(reference)">{{ referenceLabel(reference) }}</NuxtLink>
              <span v-else class="chip knowledge-reference unresolved" :title="referenceWarning(reference)" :aria-label="referenceWarning(reference)">资产不存在 · {{ referenceLabel(reference) }}</span>
            </template>
          </div>
          <small>Markdown · {{ knowledge.references.length }} 个资产引用 · 更新于 {{ formatDate(knowledge.updatedAt) }}</small>
        </div>
        <div class="asset-actions">
          <AssetActionMenu :operations="operations" :operation-to="operation => operationTarget(knowledge.id, operation.id)" @select="runOperation(knowledge, $event)" />
        </div>
      </article>
    </div>
    <div v-else class="panel empty-state">
      <strong>还没有项目知识</strong><span>先添加基本信息，再用全屏编辑器编写 Markdown 正文。</span>
      <AppButton icon="add" :to="`${assetsPath}/knowledge/new`">添加第一篇知识</AppButton>
    </div>
  </section>
  <AppConfirmDialog :open="Boolean(deletingKnowledge)" :title="`删除“${deletingKnowledge?.title || ''}”？`" description="删除后无法恢复。" confirm-label="确认删除" :busy="deleting" danger @cancel="deletingKnowledge = null" @confirm="removeKnowledge" />
</template>

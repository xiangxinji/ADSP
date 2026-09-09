<script setup lang="ts">
import type { ProjectWorkspace, RepositoryAsset, RepositoryLocalOperationStatus } from '#shared/types/asdp'

type DialogHandle = { open: (repository?: RepositoryAsset) => void }

defineProps<{
  workspace: ProjectWorkspace
  projectId: string
}>()

const emit = defineEmits<{ refresh: [] }>()
const editor = ref<DialogHandle | null>(null)
const { operations, runningOperation, deletingRepository, deleting, actionError, runOperation, removeRepository } = useRepositoryAssetActions({
  onRefresh: () => emit('refresh'),
  onEdit: repository => editor.value?.open(repository),
})

const providerLabel = (provider: RepositoryAsset['provider']) => ({ gitlab: 'GitLab', github: 'GitHub' })[provider]
const branchStrategyLabel = (strategy: RepositoryAsset['branchStrategy']) => ({ 'multi-version': '多版本分支策略', 'development-production': '开发生产策略' })[strategy]
const operationLabel = (operationId: string) => operations.find(operation => operation.id === operationId)?.label || operationId
const operationStatusLabel = (status: RepositoryLocalOperationStatus) => ({ running: '执行中', succeeded: '已完成', failed: '执行失败' })[status]
</script>

<template>
  <section class="module-section assets-module">
    <div class="asset-detail-heading">
      <div class="section-heading">
        <div><p class="overline">REPOSITORY ASSETS</p><h2>代码仓库</h2><p>管理项目引用的源代码仓库。</p></div>
        <AppButton icon="add" @click="editor?.open()">添加仓库</AppButton>
      </div>
    </div>
    <AssetOperationCatalog :operations="operations" />
    <p v-if="actionError" class="alert error-state" role="alert">{{ actionError }}</p>
    <div v-if="workspace.repositories.length" class="asset-record-list" role="region" aria-label="代码仓库列表" tabindex="0">
      <article v-for="repository in workspace.repositories" :id="`asset-${repository.id}`" :key="repository.id" class="panel asset-card asset-record-card">
        <div class="asset-icon repository-icon"><AppIcon name="repository" :size="20" /></div>
        <div class="asset-copy">
          <strong>{{ repository.name }} <span class="provider-badge">{{ providerLabel(repository.provider) }}</span></strong>
          <a :href="repository.url" target="_blank" rel="noreferrer">{{ repository.url }}</a>
          <span class="asset-note">版本分支策略：{{ branchStrategyLabel(repository.branchStrategy) }}</span>
          <span v-if="repository.localOperation" class="asset-note repository-operation-state" :class="`is-${repository.localOperation.status}`" :title="repository.localOperation.error || undefined">
            本地操作{{ operationStatusLabel(repository.localOperation.status) }}：{{ operationLabel(repository.localOperation.operationId) }}<template v-if="repository.localOperation.error"> · {{ repository.localOperation.error }}</template>
          </span>
          <span v-if="repository.note" class="asset-note">备注：{{ repository.note }}</span>
          <small>被 {{ repository.referenceCount }} 条需求引用</small>
        </div>
        <div class="asset-actions">
          <AssetActionMenu
            :operations="operations"
            :busy-operation-id="runningOperation?.id === repository.id ? runningOperation.operationId : repository.localOperation?.status === 'running' ? repository.localOperation.operationId : null"
            :disabled="Boolean(runningOperation) || repository.localOperation?.status === 'running'"
            @select="runOperation(repository, $event)"
          />
        </div>
      </article>
    </div>
    <div v-else class="panel empty-state">
      <strong>还没有代码仓库</strong><span>添加仓库后，需求可以直接引用它。</span>
      <AppButton icon="add" @click="editor?.open()">添加第一个仓库</AppButton>
    </div>
  </section>
  <ProjectRepositoryDialog ref="editor" :project-id="projectId" @saved="emit('refresh')" />
  <AppConfirmDialog
    :open="Boolean(deletingRepository)"
    :title="`删除“${deletingRepository?.name || ''}”？`"
    :description="`删除后无法恢复${deletingRepository?.referenceCount ? `，并从 ${deletingRepository.referenceCount} 条需求中移除引用` : ''}。`"
    confirm-label="确认删除"
    :busy="deleting"
    danger
    @cancel="deletingRepository = null"
    @confirm="removeRepository"
  />
</template>

<script setup lang="ts">
import { assetOperationsForModule, type AssetOperationId } from '#shared/config/asset-operations'
import type { AssetOperationDefinition } from '#shared/types/asset-operations'
import type {
  CreateRepositoryBranchInput,
  CreateRepositoryMergeRequestInput,
  CreateRepositoryWorktreeInput,
  ProjectWorkspace,
  RepositoryAsset,
  RepositoryBranchResult,
  RepositoryCloneResult,
  RepositoryLocalCloneStatusResult,
  RepositoryLocalOperationStatus,
  RepositoryMergeRequestResult,
  RepositoryUpdateResult,
  RepositoryWorktreeResult,
} from '#shared/types/asdp'

type DialogHandle = { open: (repository?: RepositoryAsset) => void }
type OperationResult = RepositoryBranchResult | RepositoryCloneResult | RepositoryLocalCloneStatusResult | RepositoryMergeRequestResult | RepositoryUpdateResult | RepositoryWorktreeResult

const props = defineProps<{
  workspace: ProjectWorkspace
  projectId: string
}>()

const emit = defineEmits<{ refresh: [] }>()
const operations = assetOperationsForModule('repositories')
const editor = ref<DialogHandle | null>(null)
const runningOperation = ref<{ id: string, operationId: AssetOperationId } | null>(null)
const deletingRepository = ref<RepositoryAsset | null>(null)
const deleting = ref(false)
const actionError = ref('')
const { success } = useAppToast()

const providerLabel = (provider: RepositoryAsset['provider']) => ({ gitlab: 'GitLab', github: 'GitHub' })[provider]
const branchStrategyLabel = (strategy: RepositoryAsset['branchStrategy']) => ({ 'multi-version': '多版本分支策略', 'development-production': '开发生产策略' })[strategy]
const operationLabel = (operationId: string) => operations.find(operation => operation.id === operationId)?.label || operationId
const operationStatusLabel = (status: RepositoryLocalOperationStatus) => ({ running: '执行中', succeeded: '已完成', failed: '执行失败' })[status]
const errorMessage = (error: any) => error?.data?.statusMessage || error?.message || '操作失败'

const runCommand = async (
  repository: RepositoryAsset,
  operation: AssetOperationDefinition,
  body?: CreateRepositoryBranchInput | CreateRepositoryMergeRequestInput | CreateRepositoryWorktreeInput,
) => {
  if (operation.execution.kind !== 'command') return
  runningOperation.value = { id: repository.id, operationId: operation.id as AssetOperationId }
  actionError.value = ''
  try {
    const result = await $fetch<OperationResult>(`/api/assets/repository/${repository.id}/operations/${operation.id}`, { method: 'POST', body })
    success('mergeRequestId' in result
      ? `合并请求 !${result.mergeRequestNumber} 已创建：${result.title}`
      : 'cloned' in result
        ? result.cloned ? `本地已克隆：${result.path}` : `本地尚未克隆：${result.path}`
        : 'source' in result
          ? `远程分支已创建：${result.branch}（基于 ${result.source}）`
          : `${operation.label}完成：${result.path}`)
  } catch (error) {
    actionError.value = errorMessage(error)
  } finally {
    runningOperation.value = null
    emit('refresh')
  }
}

const runOperation = (repository: RepositoryAsset, operation: AssetOperationDefinition) => {
  if (operation.execution.kind === 'command') {
    if (operation.id === 'repository.create-worktree') {
      const branch = window.prompt('请输入要创建工作树的现有分支名称')
      if (branch === null) return
      if (!branch.trim()) return void (actionError.value = '请输入要创建工作树的分支名称')
      return runCommand(repository, operation, { branch })
    }
    if (operation.id === 'repository.create-branch') {
      const source = window.prompt('请输入原分支名称')
      if (source === null) return
      if (!source.trim()) return void (actionError.value = '请输入原分支名称')
      const branch = window.prompt('请输入要创建的新远程分支名称')
      if (branch === null) return
      if (!branch.trim()) return void (actionError.value = '请输入新远程分支名称')
      return runCommand(repository, operation, { branch, source })
    }
    if (operation.id === 'repository.create-merge-request') {
      const source = window.prompt('请输入合并请求的源分支名称')
      if (source === null) return
      if (!source.trim()) return void (actionError.value = '请输入合并请求的源分支名称')
      const target = window.prompt('请输入合并请求的目标分支名称')
      if (target === null) return
      if (!target.trim()) return void (actionError.value = '请输入合并请求的目标分支名称')
      const title = window.prompt('请输入合并请求标题')
      if (title === null) return
      if (!title.trim()) return void (actionError.value = '请输入合并请求标题')
      return runCommand(repository, operation, { source, target, title })
    }
    return runCommand(repository, operation)
  }
  if (operation.id === 'repository.edit') return editor.value?.open(repository)
  if (operation.id === 'repository.delete') deletingRepository.value = repository
}

const removeRepository = async () => {
  if (!deletingRepository.value) return
  const repository = deletingRepository.value
  deleting.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/repositories/${repository.id}`, { method: 'DELETE' })
    deletingRepository.value = null
    emit('refresh')
    success(`“${repository.name}”已删除`)
  } catch (error) {
    actionError.value = errorMessage(error)
  } finally {
    deleting.value = false
  }
}
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

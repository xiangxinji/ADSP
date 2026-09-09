import { ref } from 'vue'
import { useAppToast } from './useAppToast'
import { assetOperationsForModule, type AssetOperationId } from '#shared/config/asset-operations'
import type { AssetOperationDefinition } from '#shared/types/asset-operations'
import type {
  CreateRepositoryBranchInput,
  CreateRepositoryMergeRequestInput,
  CreateRepositoryWorktreeInput,
  RepositoryAsset,
  RepositoryBranchResult,
  RepositoryCloneResult,
  RepositoryLocalCloneStatusResult,
  RepositoryMergeRequestResult,
  RepositoryUpdateResult,
  RepositoryWorktreeResult,
} from '#shared/types/asdp'

type OperationResult = RepositoryBranchResult | RepositoryCloneResult | RepositoryLocalCloneStatusResult
  | RepositoryMergeRequestResult | RepositoryUpdateResult | RepositoryWorktreeResult

type RepositoryAssetActionOptions = {
  onRefresh: () => void
  onEdit: (repository: RepositoryAsset) => void
}

export const useRepositoryAssetActions = (options: RepositoryAssetActionOptions) => {
  const operations = assetOperationsForModule('repositories')
  const runningOperation = ref<{ id: string, operationId: AssetOperationId } | null>(null)
  const deletingRepository = ref<RepositoryAsset | null>(null)
  const deleting = ref(false)
  const actionError = ref('')
  const { success } = useAppToast()

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
      options.onRefresh()
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
    if (operation.id === 'repository.edit') return options.onEdit(repository)
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
      options.onRefresh()
      success(`“${repository.name}”已删除`)
    } catch (error) {
      actionError.value = errorMessage(error)
    } finally {
      deleting.value = false
    }
  }

  return { operations, runningOperation, deletingRepository, deleting, actionError, runOperation, removeRepository }
}

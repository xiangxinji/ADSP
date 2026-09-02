import type {
  CreateRepositoryInput,
  CreateRepositoryWorktreeInput,
  UpdateRepositoryInput,
} from '../../shared/types/asdp'
import { repositoryBranchStrategies, repositoryProviders } from '../../shared/types/asdp'
import { createAssetOperationError } from '../utils/asset-operation-error'
import { bodyObject, enumValue, optionalText, requiredText } from '../utils/http-input'

export const repositoryPayload = (
  value: unknown,
  partial = false,
): CreateRepositoryInput | UpdateRepositoryInput => {
  const body = bodyObject(value)
  return {
    provider: partial && body.provider === undefined
      ? undefined
      : enumValue(body.provider, repositoryProviders, 'gitlab'),
    branchStrategy: partial && body.branchStrategy === undefined
      ? undefined
      : enumValue(body.branchStrategy, repositoryBranchStrategies, 'multi-version'),
    externalId: partial && body.externalId === undefined
      ? undefined
      : body.externalId === null
        ? null
        : optionalText(body.externalId) || null,
    name: partial && body.name === undefined ? undefined : requiredText(body.name, 'name'),
    note: partial && body.note === undefined ? undefined : optionalText(body.note),
    url: partial && body.url === undefined ? undefined : requiredText(body.url, 'url'),
  }
}

export const repositoryWorktreePayload = (value: unknown): CreateRepositoryWorktreeInput => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createAssetOperationError(400, 'repository.invalid-worktree-input', '请求体必须是 JSON 对象')
  }
  const branchValue = (value as Record<string, unknown>).branch
  if (typeof branchValue !== 'string' || !branchValue.trim()) {
    throw createAssetOperationError(400, 'repository.worktree-branch-required', 'branch is required')
  }
  const branch = branchValue.trim()
  if (branch.length > 255
    || branch === '@'
    || branch.startsWith('-')
    || branch.startsWith('.')
    || branch.startsWith('/')
    || branch.endsWith('.')
    || branch.endsWith('/')
    || branch.endsWith('.lock')
    || branch.includes('..')
    || branch.includes('//')
    || branch.includes('@{')
    || /[\x00-\x20~^:?*\[\]\\<>|"]/.test(branch)) {
    throw createAssetOperationError(400, 'repository.invalid-worktree-branch', 'branch 不是有效的 Git 分支名称')
  }
  return { branch }
}

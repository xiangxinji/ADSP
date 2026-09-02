import type {
  CreateRepositoryBranchInput,
  CreateRepositoryInput,
  CreateRepositoryMergeRequestInput,
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
  return {
    branch: gitBranchName(
      branchValue,
      'repository.worktree-branch-required',
      'repository.invalid-worktree-branch',
      'branch',
    ),
  }
}

const gitBranchName = (
  value: unknown,
  requiredCode: string,
  invalidCode: string,
  field: string,
) => {
  const branchValue = value
  if (typeof branchValue !== 'string' || !branchValue.trim()) {
    throw createAssetOperationError(400, requiredCode, `${field} is required`)
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
    throw createAssetOperationError(400, invalidCode, `${field} 不是有效的 Git 分支名称`)
  }
  return branch
}

export const repositoryCreateBranchPayload = (value: unknown): CreateRepositoryBranchInput => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createAssetOperationError(400, 'repository.invalid-create-branch-input', '请求体必须是 JSON 对象')
  }
  const body = value as Record<string, unknown>
  return {
    branch: gitBranchName(body.branch, 'repository.branch-required', 'repository.invalid-branch', 'branch'),
    source: gitBranchName(body.source, 'repository.source-required', 'repository.invalid-source', 'source'),
  }
}

export const repositoryCreateMergeRequestPayload = (value: unknown): CreateRepositoryMergeRequestInput => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createAssetOperationError(400, 'repository.invalid-create-merge-request-input', '请求体必须是 JSON 对象')
  }
  const body = value as Record<string, unknown>
  const source = gitBranchName(body.source, 'repository.source-required', 'repository.invalid-source', 'source')
  const target = gitBranchName(body.target, 'repository.target-required', 'repository.invalid-target', 'target')
  if (source === target) {
    throw createAssetOperationError(400, 'repository.merge-request-branches-equal', 'source 和 target 不能相同')
  }
  if (typeof body.title !== 'string' || !body.title.trim()) {
    throw createAssetOperationError(400, 'repository.merge-request-title-required', 'title is required')
  }
  const title = body.title.trim()
  if (title.length > 255) {
    throw createAssetOperationError(400, 'repository.invalid-merge-request-title', 'title 不能超过 255 个字符')
  }
  return { source, target, title }
}

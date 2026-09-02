import { createError } from 'h3'
import type { GitLabIdentity, GitLabRepository, GitLabRepositoryPage } from '../../shared/types/asdp'
import { createAssetOperationError } from '../utils/asset-operation-error'

export type GitLabCredentials = {
  baseUrl: string
  token: string
}

type GitLabUserResponse = {
  id: number
  name: string
  username: string
}

type GitLabProjectResponse = {
  id: number
  name: string
  name_with_namespace: string
  web_url: string
  http_url_to_repo: string
  default_branch: string | null
  visibility: string
  archived: boolean
}

type GitLabBranchResponse = {
  name: string
}

type GitLabMergeRequestResponse = {
  id: number
  iid: number
  title: string
  source_branch: string
  target_branch: string
  web_url: string
}

type GitLabRequestOptions = {
  method?: 'GET' | 'POST'
  query?: Record<string, string>
  onConnectionError?: () => never
  onResponseError?: (status: number, detail: string) => never
}

const responseValueMessage = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(responseValueMessage).filter(Boolean).join(', ')
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, detail]) => {
        const message = responseValueMessage(detail)
        return message ? `${key}: ${message}` : ''
      })
      .filter(Boolean)
      .join(', ')
  }
  return ''
}

const responseMessage = async (response: Response) => {
  try {
    const body = await response.json() as { message?: unknown, error_description?: unknown }
    const message = responseValueMessage(body.message) || responseValueMessage(body.error_description)
    if (message) return message
  } catch {
    // GitLab may return an empty or non-JSON error response.
  }
  return response.statusText || `HTTP ${response.status}`
}

export const normalizeGitLabBaseUrl = (value: string) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'GitLab 地址无效' })
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw createError({ statusCode: 400, statusMessage: 'GitLab 地址必须使用 HTTP 或 HTTPS，且不能包含凭据' })
  }
  url.search = ''
  url.hash = ''
  url.pathname = url.pathname.replace(/\/(api\/v4)?\/?$/, '')
  return url.toString().replace(/\/$/, '')
}

const gitLabRequest = async <T>(
  credentials: GitLabCredentials,
  path: string,
  options: GitLabRequestOptions = {},
) => {
  const url = new URL(`${credentials.baseUrl}/api/v4/${path.replace(/^\//, '')}`)
  Object.entries(options.query || {}).forEach(([key, value]) => url.searchParams.set(key, value))

  let response: Response
  try {
    response = await fetch(url, {
      method: options.method || 'GET',
      headers: { 'Private-Token': credentials.token },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    if (options.onConnectionError) options.onConnectionError()
    throw createError({ statusCode: 502, statusMessage: '无法连接 GitLab，请检查地址和网络' })
  }

  if (!response.ok) {
    const detail = await responseMessage(response)
    if (options.onResponseError) options.onResponseError(response.status, detail)
    if (response.status === 401) {
      throw createError({ statusCode: 401, statusMessage: 'GitLab Access Token 无效或已过期' })
    }
    if (response.status === 403) {
      throw createError({ statusCode: 403, statusMessage: 'GitLab Access Token 权限不足' })
    }
    throw createError({ statusCode: 502, statusMessage: `GitLab API 请求失败：${detail}` })
  }

  return { data: await response.json() as T, headers: response.headers }
}

export const verifyGitLabConnection = async (credentials: GitLabCredentials): Promise<GitLabIdentity> => {
  const { data } = await gitLabRequest<GitLabUserResponse>(credentials, 'user')
  return { id: data.id, name: data.name, username: data.username }
}

export const listGitLabRepositories = async (
  credentials: GitLabCredentials,
  options: { search?: string, page: number, perPage: number },
): Promise<GitLabRepositoryPage> => {
  const { data, headers } = await gitLabRequest<GitLabProjectResponse[]>(credentials, 'projects', {
    query: {
      membership: 'true',
      simple: 'true',
      archived: 'false',
      order_by: 'last_activity_at',
      sort: 'desc',
      page: String(options.page),
      per_page: String(options.perPage),
      ...(options.search ? { search: options.search } : {}),
    },
  })

  const totalHeader = headers.get('x-total')
  const nextPageHeader = headers.get('x-next-page')
  const items: GitLabRepository[] = data.map(project => ({
    id: project.id,
    name: project.name,
    nameWithNamespace: project.name_with_namespace,
    webUrl: project.web_url,
    httpUrlToRepo: project.http_url_to_repo,
    defaultBranch: project.default_branch || 'main',
    visibility: project.visibility,
    archived: project.archived,
  }))

  return {
    items,
    page: options.page,
    perPage: options.perPage,
    total: totalHeader ? Number(totalHeader) : null,
    nextPage: nextPageHeader ? Number(nextPageHeader) : null,
  }
}

export const createGitLabRepositoryBranch = async (
  credentials: GitLabCredentials,
  repositoryExternalId: string,
  input: { branch: string, source: string },
) => {
  const { data } = await gitLabRequest<GitLabBranchResponse>(
    credentials,
    `projects/${encodeURIComponent(repositoryExternalId)}/repository/branches`,
    {
      method: 'POST',
      query: { branch: input.branch, ref: input.source },
      onConnectionError: () => {
        throw createAssetOperationError(502, 'repository.gitlab-unreachable', '无法连接 GitLab，请检查地址和网络')
      },
      onResponseError: (status, detail) => {
        const normalizedDetail = detail.toLowerCase().replaceAll('_', ' ')
        if (status === 401) {
          throw createAssetOperationError(401, 'repository.gitlab-authentication-failed', 'GitLab Access Token 无效或已过期')
        }
        if (status === 403) {
          throw createAssetOperationError(403, 'repository.gitlab-permission-denied', 'GitLab Access Token 没有创建分支的权限')
        }
        if (status === 404) {
          throw createAssetOperationError(404, 'repository.remote-repository-not-found', 'GitLab 仓库不存在或当前凭据不可见')
        }
        if (status === 400 && normalizedDetail.includes('already exists')) {
          throw createAssetOperationError(409, 'repository.branch-already-exists', `远程分支已存在：${input.branch}`)
        }
        if (status === 400) {
          throw createAssetOperationError(404, 'repository.source-not-found', `原分支不存在：${input.source}`)
        }
        throw createAssetOperationError(502, 'repository.gitlab-api-failed', `GitLab API 创建分支失败：${detail}`)
      },
    },
  )
  return data.name
}

export const createGitLabMergeRequest = async (
  credentials: GitLabCredentials,
  repositoryExternalId: string,
  input: { source: string, target: string, title: string },
) => {
  const { data } = await gitLabRequest<GitLabMergeRequestResponse>(
    credentials,
    `projects/${encodeURIComponent(repositoryExternalId)}/merge_requests`,
    {
      method: 'POST',
      query: {
        source_branch: input.source,
        target_branch: input.target,
        title: input.title,
      },
      onConnectionError: () => {
        throw createAssetOperationError(502, 'repository.gitlab-unreachable', '无法连接 GitLab，请检查地址和网络')
      },
      onResponseError: (status, detail) => {
        const normalizedDetail = detail.toLowerCase().replaceAll('_', ' ')
        if (status === 401) {
          throw createAssetOperationError(401, 'repository.gitlab-authentication-failed', 'GitLab Access Token 无效或已过期')
        }
        if (status === 403) {
          throw createAssetOperationError(403, 'repository.gitlab-permission-denied', 'GitLab Access Token 没有创建合并请求的权限')
        }
        if (status === 404) {
          throw createAssetOperationError(404, 'repository.remote-repository-not-found', 'GitLab 仓库不存在或当前凭据不可见')
        }
        if (normalizedDetail.includes('source branch') && normalizedDetail.includes('does not exist')) {
          throw createAssetOperationError(404, 'repository.source-not-found', `源分支不存在：${input.source}`)
        }
        if (normalizedDetail.includes('target branch') && normalizedDetail.includes('does not exist')) {
          throw createAssetOperationError(404, 'repository.target-not-found', `目标分支不存在：${input.target}`)
        }
        if (normalizedDetail.includes('already exists')) {
          throw createAssetOperationError(409, 'repository.merge-request-already-exists', '相同分支间的打开合并请求已存在')
        }
        if (normalizedDetail.includes('no commits')) {
          throw createAssetOperationError(409, 'repository.merge-request-no-changes', '源分支没有可合并到目标分支的更改')
        }
        if (status === 400 || status === 409) {
          throw createAssetOperationError(400, 'repository.merge-request-rejected', `GitLab 拒绝创建合并请求：${detail}`)
        }
        throw createAssetOperationError(502, 'repository.gitlab-api-failed', `GitLab API 创建合并请求失败：${detail}`)
      },
    },
  )
  return {
    mergeRequestId: String(data.id),
    mergeRequestNumber: String(data.iid),
    title: data.title,
    source: data.source_branch,
    target: data.target_branch,
    webUrl: data.web_url,
  }
}

import { createError } from 'h3'
import type { GitLabIdentity, GitLabRepository, GitLabRepositoryPage } from '../../shared/types/asdp'

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

const responseMessage = async (response: Response) => {
  try {
    const body = await response.json() as { message?: unknown, error_description?: unknown }
    if (typeof body.message === 'string') return body.message
    if (typeof body.error_description === 'string') return body.error_description
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

const gitLabRequest = async <T>(credentials: GitLabCredentials, path: string, query?: Record<string, string>) => {
  const url = new URL(`${credentials.baseUrl}/api/v4/${path.replace(/^\//, '')}`)
  Object.entries(query || {}).forEach(([key, value]) => url.searchParams.set(key, value))

  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'Private-Token': credentials.token },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: '无法连接 GitLab，请检查地址和网络' })
  }

  if (!response.ok) {
    const detail = await responseMessage(response)
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
    membership: 'true',
    simple: 'true',
    archived: 'false',
    order_by: 'last_activity_at',
    sort: 'desc',
    page: String(options.page),
    per_page: String(options.perPage),
    ...(options.search ? { search: options.search } : {}),
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

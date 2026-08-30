import { createError } from 'h3'
import { listGitLabRepositories } from '../../../utils/gitlab-adapter'
import { getGitLabCredentials } from '../../../utils/integration-settings'

export default defineEventHandler(async (event) => {
  const credentials = getGitLabCredentials()
  if (!credentials) throw createError({ statusCode: 409, statusMessage: '请先在全局设置中配置 GitLab' })

  const query = getQuery(event)
  const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1)
  const perPage = Math.min(100, Math.max(1, Number.parseInt(String(query.perPage || '20'), 10) || 20))
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : ''
  return listGitLabRepositories(credentials, { search, page, perPage })
})

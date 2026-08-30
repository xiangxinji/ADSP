import { listAvailableGitLabRepositories } from '../../../services/gitlab'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1)
  const perPage = Math.min(100, Math.max(1, Number.parseInt(String(query.perPage || '20'), 10) || 20))
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : ''
  return listAvailableGitLabRepositories({ search, page, perPage })
})

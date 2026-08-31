import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type {
  EnvironmentAsset,
  GitLabIdentity,
  GitLabRepositoryPage,
  GitLabSettings,
  KnowledgeAsset,
  Project,
  ProjectMember,
  ProjectSummary,
  ProjectWorkspace,
  RepositoryAsset,
  Requirement,
  RequirementStatus,
  RequirementVersion,
  UserAccount,
} from '../../shared/types/asdp'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'

type ApiMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
type ApiRoute = `${ApiMethod} /api/${string}`
type ApiRouteCase = {
  route: ApiRoute
  run: () => Promise<void>
}

const discoverApiRoutes = () => {
  const apiRoot = join(process.cwd(), 'server', 'api')
  const files = (directory: string, prefix = ''): string[] => readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => entry.isDirectory()
      ? files(join(directory, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`])

  return files(apiRoot)
    .map(file => {
      const match = file.match(/\.(delete|get|patch|post|put)\.ts$/)
      if (!match) return null
      const method = match[1].toUpperCase() as ApiMethod
      const segments = file
        .replace(/\.(delete|get|patch|post|put)\.ts$/, '')
        .split('/')
        .filter(segment => segment !== 'index')
        .map(segment => segment.replace(/^\[(?:\.\.\.)?(.+)]$/, ':$1'))
      return `${method} /api/${segments.join('/')}` as ApiRoute
    })
    .filter((route): route is ApiRoute => Boolean(route))
    .sort()
}

let harness: ApiTestHarness
let projectId = ''
let foreignProjectId = ''
let initialStatusId = ''
let repositoryId = ''
let memberId = ''
let environmentId = ''
let knowledgeId = ''
let knowledgeContent = ''
let customStatusId = ''
let version2Id = ''
let version3Id = ''
let requirementId = ''
let userId = ''

const routeCases: ApiRouteCase[] = [
  {
    route: 'GET /api/projects',
    run: async () => {
      const response = await harness.request<ProjectSummary[]>('/api/projects')
      expect(response.status).toBe(200)
      expect(response.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'project-asdp', name: 'ForgePilot Platform' }),
      ]))
    },
  },
  {
    route: 'POST /api/projects',
    run: async () => {
      const response = await harness.request<Project>('/api/projects', {
        method: 'POST',
        body: { name: 'API 测试项目', description: '使用隔离数据库' },
      })
      expect(response.status).toBe(201)
      expect(response.data).toMatchObject({ name: 'API 测试项目', description: '使用隔离数据库' })
      projectId = response.data.id
    },
  },
  {
    route: 'GET /api/projects/:id',
    run: async () => {
      const response = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
      expect(response.status).toBe(200)
      expect(response.data.project.id).toBe(projectId)
      expect(response.data.knowledge).toEqual([])
      expect(response.data.requirementVersions).toEqual([])
      expect(response.data.requirementStatuses).toHaveLength(6)
      const initialStatuses = response.data.requirementStatuses.filter(status => status.isInitial)
      expect(initialStatuses).toHaveLength(1)
      initialStatusId = initialStatuses[0].id
    },
  },
  {
    route: 'PATCH /api/projects/:id',
    run: async () => {
      const response = await harness.request<Project>(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: { name: 'API 测试项目（已更新）' },
      })
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({ id: projectId, name: 'API 测试项目（已更新）' })
    },
  },
  {
    route: 'GET /api/users',
    run: async () => {
      const response = await harness.request<UserAccount[]>('/api/users')
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
    },
  },
  {
    route: 'POST /api/users',
    run: async () => {
      const response = await harness.request<UserAccount>('/api/users', {
        method: 'POST',
        body: { name: '接口测试员', email: 'api-tester@example.com', role: 'member' },
      })
      expect(response.status).toBe(201)
      expect(response.data).toMatchObject({ email: 'api-tester@example.com', role: 'member' })
      userId = response.data.id
    },
  },
  {
    route: 'GET /api/settings/gitlab',
    run: async () => {
      const response = await harness.request<GitLabSettings>('/api/settings/gitlab')
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({ configured: false, connectedUser: null, tokenHint: '' })
    },
  },
  {
    route: 'POST /api/settings/gitlab/test',
    run: async () => {
      const rejected = await harness.request('/api/settings/gitlab/test', {
        method: 'POST',
        body: { baseUrl: harness.gitLabBaseUrl, token: 'invalid-token' },
      })
      expect(rejected.status).toBe(401)

      const response = await harness.request<GitLabIdentity>('/api/settings/gitlab/test', {
        method: 'POST',
        body: { baseUrl: harness.gitLabBaseUrl, token: 'valid-token' },
      })
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ id: 42, name: 'ForgePilot Tester', username: 'forgepilot-tester' })

      const settings = await harness.request<GitLabSettings>('/api/settings/gitlab')
      expect(settings.data.configured).toBe(false)
    },
  },
  {
    route: 'PUT /api/settings/gitlab',
    run: async () => {
      const response = await harness.request<GitLabSettings>('/api/settings/gitlab', {
        method: 'PUT',
        body: { baseUrl: harness.gitLabBaseUrl, token: 'valid-token' },
      })
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({
        baseUrl: harness.gitLabBaseUrl,
        configured: true,
        tokenHint: '••••oken',
      })
      expect(response.data.connectedUser).toEqual({ id: 42, name: 'ForgePilot Tester', username: 'forgepilot-tester' })
      expect(response.data).not.toHaveProperty('token')

      const stored = await harness.request<GitLabSettings>('/api/settings/gitlab')
      expect(stored.data).not.toHaveProperty('token')
      expect(stored.data.configured).toBe(true)
    },
  },
  {
    route: 'GET /api/integrations/gitlab/repositories',
    run: async () => {
      const response = await harness.request<GitLabRepositoryPage>('/api/integrations/gitlab/repositories?search=asdp&page=2&perPage=200')
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({ page: 2, perPage: 100, total: 1, nextPage: null })
      expect(response.data.items[0]).toMatchObject({ id: 101, name: 'forgepilot-api', defaultBranch: 'main' })

      const request = harness.gitLabRequests.at(-1)
      expect(request).toMatchObject({
        pathname: '/api/v4/projects',
        token: 'valid-token',
        query: expect.objectContaining({ membership: 'true', page: '2', per_page: '100', search: 'asdp' }),
      })
    },
  },
  {
    route: 'POST /api/projects/:id/repositories',
    run: async () => {
      const response = await harness.request<RepositoryAsset>(`/api/projects/${projectId}/repositories`, {
        method: 'POST',
        body: {
          provider: 'gitlab',
          externalId: null,
          name: 'forgepilot-api-test',
          note: '接口测试仓库',
          url: 'https://gitlab.example.com/asdp/api-test.git',
          defaultBranch: 'main',
        },
      })
      expect(response.status).toBe(201)
      expect(response.data).toMatchObject({ externalId: null, note: '接口测试仓库' })
      repositoryId = response.data.id
    },
  },
  {
    route: 'PATCH /api/repositories/:id',
    run: async () => {
      const response = await harness.request<RepositoryAsset>(`/api/repositories/${repositoryId}`, {
        method: 'PATCH',
        body: { note: '已更新的接口测试仓库', defaultBranch: 'develop' },
      })
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({ id: repositoryId, note: '已更新的接口测试仓库', defaultBranch: 'develop' })
    },
  },
  {
    route: 'POST /api/projects/:id/members',
    run: async () => {
      const response = await harness.request<ProjectMember>(`/api/projects/${projectId}/members`, {
        method: 'POST',
        body: { userId, role: '开发负责人' },
      })
      expect(response.status).toBe(201)
      expect(response.data).toMatchObject({ projectId, userId, role: '开发负责人' })
      memberId = response.data.id
    },
  },
  {
    route: 'PATCH /api/members/:id',
    run: async () => {
      const response = await harness.request<ProjectMember>(`/api/members/${memberId}`, {
        method: 'PATCH',
        body: { role: '技术负责人' },
      })
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({ id: memberId, role: '技术负责人' })
    },
  },
  {
    route: 'POST /api/projects/:id/environments',
    run: async () => {
      const rejected = await harness.request(`/api/projects/${projectId}/environments`, {
        method: 'POST',
        body: {
          address: 'https://invalid-environment.example.com',
          type: 'testing',
          accounts: [{ account: 'qa-user' }],
        },
      })
      expect(rejected.status).toBe(400)

      const response = await harness.request<EnvironmentAsset>(`/api/projects/${projectId}/environments`, {
        method: 'POST',
        body: {
          address: 'https://test.example.com',
          type: 'testing',
          accounts: [
            { account: 'qa-user', password: 'qa-password' },
            { account: 'release-bot', password: 'release-password' },
          ],
        },
      })
      expect(response.status).toBe(201)
      expect(response.data).toMatchObject({
        projectId,
        type: 'testing',
        accounts: [
          { account: 'qa-user', password: 'qa-password' },
          { account: 'release-bot', password: 'release-password' },
        ],
      })
      environmentId = response.data.id
    },
  },
  {
    route: 'PATCH /api/environments/:id',
    run: async () => {
      const response = await harness.request<EnvironmentAsset>(`/api/environments/${environmentId}`, {
        method: 'PATCH',
        body: {
          address: 'https://staging.example.com',
          type: 'development',
          accounts: [{ account: 'developer', password: 'developer-password' }],
        },
      })
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({
        id: environmentId,
        address: 'https://staging.example.com',
        type: 'development',
        accounts: [{ account: 'developer', password: 'developer-password' }],
      })
    },
  },
  {
    route: 'POST /api/projects/:id/knowledge',
    run: async () => {
      const rejected = await harness.request(`/api/projects/${projectId}/knowledge`, {
        method: 'POST',
        body: { title: '空知识', content: '   ' },
      })
      expect(rejected.status).toBe(400)

      knowledgeContent = [
        '# 接口测试知识',
        '',
        `代码入口：[[代码仓库：${repositoryId}]]`,
        `负责人：[[项目成员：${memberId}]]`,
        `验证环境：[[环境：${environmentId}]]`,
      ].join('\n')
      const response = await harness.request<KnowledgeAsset>(`/api/projects/${projectId}/knowledge`, {
        method: 'POST',
        body: { title: 'API 测试知识', content: knowledgeContent },
      })
      expect(response.status).toBe(201)
      expect(response.data).toMatchObject({ projectId, title: 'API 测试知识', content: knowledgeContent })
      expect(response.data.references).toEqual(expect.arrayContaining([
        expect.objectContaining({ targetType: 'repository', recordId: repositoryId, resolved: true }),
        expect.objectContaining({ targetType: 'member', recordId: memberId, resolved: true }),
        expect.objectContaining({ targetType: 'environment', recordId: environmentId, resolved: true }),
      ]))
      knowledgeId = response.data.id

      const projects = await harness.request<ProjectSummary[]>('/api/projects')
      expect(projects.data.find(project => project.id === projectId)?.knowledgeCount).toBe(1)
    },
  },
  {
    route: 'PATCH /api/knowledge/:id',
    run: async () => {
      const content = `${knowledgeContent}\n相关知识：[[知识：${knowledgeId}]]\n无效引用：[[未知资产：missing-id]]`
      const response = await harness.request<KnowledgeAsset>(`/api/knowledge/${knowledgeId}`, {
        method: 'PATCH',
        body: { title: 'API 测试知识（已更新）', content },
      })
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({ id: knowledgeId, title: 'API 测试知识（已更新）', content })
      expect(response.data.references).toEqual(expect.arrayContaining([
        expect.objectContaining({ targetType: 'knowledge', recordId: knowledgeId, resolved: true }),
        expect.objectContaining({ assetType: '未知资产', targetType: null, recordId: 'missing-id', resolved: false }),
      ]))
    },
  },
  {
    route: 'POST /api/projects/:id/requirement-statuses',
    run: async () => {
      const response = await harness.request<RequirementStatus>(`/api/projects/${projectId}/requirement-statuses`, {
        method: 'POST',
        body: {
          key: 'reviewing',
          name: '评审中',
          color: '#2563eb',
          sortOrder: 60,
          isInitial: false,
          isTerminal: false,
        },
      })
      expect(response.status).toBe(201)
      expect(response.data).toMatchObject({ projectId, key: 'reviewing', name: '评审中' })
      customStatusId = response.data.id
    },
  },
  {
    route: 'PATCH /api/requirement-statuses/:id',
    run: async () => {
      const response = await harness.request<RequirementStatus>(`/api/requirement-statuses/${customStatusId}`, {
        method: 'PATCH',
        body: { name: '代码评审', color: '#6941c6' },
      })
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({ id: customStatusId, name: '代码评审', color: '#6941c6' })
    },
  },
  {
    route: 'POST /api/projects/:id/requirement-versions',
    run: async () => {
      const rejected = await harness.request(`/api/projects/${projectId}/requirement-versions`, {
        method: 'POST',
        body: { major: 1.5 },
      })
      expect(rejected.status).toBe(400)

      const version2 = await harness.request<RequirementVersion>(`/api/projects/${projectId}/requirement-versions`, {
        method: 'POST',
        body: { major: 2 },
      })
      expect(version2.status).toBe(201)
      expect(version2.data).toMatchObject({ projectId, name: 'v2.x', isLatest: true, requirementCount: 0 })
      version2Id = version2.data.id

      const version3 = await harness.request<RequirementVersion>(`/api/projects/${projectId}/requirement-versions`, {
        method: 'POST',
        body: { major: 3 },
      })
      expect(version3.status).toBe(201)
      expect(version3.data).toMatchObject({ projectId, name: 'v3.x', isLatest: true })
      version3Id = version3.data.id

      const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
      expect(workspace.data.requirementVersions.map(version => ({ name: version.name, latest: version.isLatest })))
        .toEqual([{ name: 'v3.x', latest: true }, { name: 'v2.x', latest: false }])
    },
  },
  {
    route: 'PATCH /api/requirement-versions/:id',
    run: async () => {
      const response = await harness.request<RequirementVersion>(`/api/requirement-versions/${version3Id}`, {
        method: 'PATCH',
        body: { major: 1 },
      })
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({ id: version3Id, name: 'v1.x', isLatest: false })

      const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
      expect(workspace.data.requirementVersions.map(version => ({ name: version.name, latest: version.isLatest })))
        .toEqual([{ name: 'v2.x', latest: true }, { name: 'v1.x', latest: false }])
    },
  },
  {
    route: 'POST /api/projects/:id/requirements',
    run: async () => {
      const foreignProject = await harness.request<Project>('/api/projects', {
        method: 'POST',
        body: { name: '外部项目', description: '用于验证项目边界' },
      })
      foreignProjectId = foreignProject.data.id
      const foreignRepository = await harness.request<RepositoryAsset>(`/api/projects/${foreignProjectId}/repositories`, {
        method: 'POST',
        body: {
          provider: 'github',
          name: 'foreign-repository',
          url: 'https://github.com/asdp/foreign-repository.git',
          defaultBranch: 'main',
        },
      })
      const foreignVersion = await harness.request<RequirementVersion>(`/api/projects/${foreignProjectId}/requirement-versions`, {
        method: 'POST',
        body: { major: 9 },
      })
      const rejected = await harness.request(`/api/projects/${projectId}/requirements`, {
        method: 'POST',
        body: {
          title: '非法跨项目引用',
          description: '',
          acceptanceCriteria: '',
          statusId: initialStatusId,
          priority: 'medium',
          versionIds: [foreignVersion.data.id],
          repositoryIds: [foreignRepository.data.id],
          memberIds: [memberId],
        },
      })
      expect(rejected.status).toBe(400)

      const response = await harness.request<Requirement>(`/api/projects/${projectId}/requirements`, {
        method: 'POST',
        body: {
          title: '验证全部接口',
          description: '通过真实 HTTP 路由验证',
          acceptanceCriteria: '所有接口返回符合契约',
          statusId: initialStatusId,
          priority: 'high',
          versionIds: [version2Id, version3Id],
          repositoryIds: [repositoryId],
          memberIds: [memberId],
        },
      })
      expect(response.status).toBe(201)
      expect(response.data.versionIds).toEqual([version2Id, version3Id])
      expect(response.data.versions.map(version => version.name)).toEqual(['v2.x', 'v1.x'])
      expect(response.data.repositoryIds).toEqual([repositoryId])
      expect(response.data.memberIds).toEqual([memberId])
      requirementId = response.data.id
    },
  },
  {
    route: 'PATCH /api/requirements/:id',
    run: async () => {
      const rejectedDelete = await harness.request(`/api/requirement-versions/${version3Id}`, { method: 'DELETE' })
      expect(rejectedDelete.status).toBe(409)

      const response = await harness.request<Requirement>(`/api/requirements/${requirementId}`, {
        method: 'PATCH',
        body: {
          title: '验证全部接口（已更新）',
          statusId: customStatusId,
          priority: 'urgent',
          versionIds: [version2Id],
        },
      })
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({
        id: requirementId,
        title: '验证全部接口（已更新）',
        statusId: customStatusId,
        priority: 'urgent',
      })
      expect(response.data.repositories[0].id).toBe(repositoryId)
      expect(response.data.members[0].id).toBe(memberId)
      expect(response.data.versionIds).toEqual([version2Id])
      expect(response.data.versions[0]).toMatchObject({ id: version2Id, isLatest: true })
    },
  },
  {
    route: 'DELETE /api/repositories/:id',
    run: async () => {
      const response = await harness.request<null>(`/api/repositories/${repositoryId}`, { method: 'DELETE' })
      expect(response.status).toBe(204)
      const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
      expect(workspace.data.requirements[0].repositoryIds).toEqual([])
      expect(workspace.data.requirements[0].repositories).toEqual([])
      expect(workspace.data.knowledge[0].references).toContainEqual(expect.objectContaining({
        targetType: 'repository',
        recordId: repositoryId,
        resolved: false,
      }))
    },
  },
  {
    route: 'DELETE /api/members/:id',
    run: async () => {
      const response = await harness.request<null>(`/api/members/${memberId}`, { method: 'DELETE' })
      expect(response.status).toBe(204)
      const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
      expect(workspace.data.requirements[0].memberIds).toEqual([])
      expect(workspace.data.requirements[0].members).toEqual([])
      expect(workspace.data.knowledge[0].references).toContainEqual(expect.objectContaining({
        targetType: 'member',
        recordId: memberId,
        resolved: false,
      }))
    },
  },
  {
    route: 'DELETE /api/environments/:id',
    run: async () => {
      const response = await harness.request<null>(`/api/environments/${environmentId}`, { method: 'DELETE' })
      expect(response.status).toBe(204)
      const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
      expect(workspace.data.environments).toEqual([])
      expect(workspace.data.knowledge[0].references).toContainEqual(expect.objectContaining({
        targetType: 'environment',
        recordId: environmentId,
        resolved: false,
      }))
    },
  },
  {
    route: 'DELETE /api/knowledge/:id',
    run: async () => {
      const response = await harness.request<null>(`/api/knowledge/${knowledgeId}`, { method: 'DELETE' })
      expect(response.status).toBe(204)
      const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
      expect(workspace.data.knowledge).toEqual([])
    },
  },
  {
    route: 'DELETE /api/requirements/:id',
    run: async () => {
      const response = await harness.request<null>(`/api/requirements/${requirementId}`, { method: 'DELETE' })
      expect(response.status).toBe(204)
      const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
      expect(workspace.data.requirements).toEqual([])
    },
  },
  {
    route: 'DELETE /api/requirement-versions/:id',
    run: async () => {
      const version2 = await harness.request<null>(`/api/requirement-versions/${version2Id}`, { method: 'DELETE' })
      const version1 = await harness.request<null>(`/api/requirement-versions/${version3Id}`, { method: 'DELETE' })
      expect(version2.status).toBe(204)
      expect(version1.status).toBe(204)
      const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
      expect(workspace.data.requirementVersions).toEqual([])
    },
  },
  {
    route: 'DELETE /api/requirement-statuses/:id',
    run: async () => {
      const response = await harness.request<null>(`/api/requirement-statuses/${customStatusId}`, { method: 'DELETE' })
      expect(response.status).toBe(204)
      const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
      expect(workspace.data.requirementStatuses.some(status => status.id === customStatusId)).toBe(false)
    },
  },
  {
    route: 'DELETE /api/settings/gitlab',
    run: async () => {
      const response = await harness.request<null>('/api/settings/gitlab', { method: 'DELETE' })
      expect(response.status).toBe(204)
      const settings = await harness.request<GitLabSettings>('/api/settings/gitlab')
      expect(settings.data.configured).toBe(false)
      const repositories = await harness.request('/api/integrations/gitlab/repositories')
      expect(repositories.status).toBe(409)
    },
  },
  {
    route: 'DELETE /api/projects/:id',
    run: async () => {
      const response = await harness.request<null>(`/api/projects/${projectId}`, { method: 'DELETE' })
      expect(response.status).toBe(204)
      const foreignResponse = await harness.request<null>(`/api/projects/${foreignProjectId}`, { method: 'DELETE' })
      expect(foreignResponse.status).toBe(204)
      const missing = await harness.request(`/api/projects/${projectId}`)
      expect(missing.status).toBe(404)
      const projects = await harness.request<ProjectSummary[]>('/api/projects')
      expect(projects.data.some(project => [projectId, foreignProjectId].includes(project.id))).toBe(false)
    },
  },
]

describe.sequential('ForgePilot HTTP API', () => {
  beforeAll(async () => {
    harness = await startApiTestHarness()
  })

  afterAll(async () => {
    await harness?.stop()
  })

  routeCases.forEach(routeCase => test(routeCase.route, routeCase.run))

  test('every API route has an HTTP integration test', () => {
    expect(routeCases.map(routeCase => routeCase.route).sort()).toEqual(discoverApiRoutes())
  })
})

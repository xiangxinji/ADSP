import { beforeEach, describe, expect, test, vi } from 'vitest'
import { executeProjectAssetOperation } from '../server/services/project-asset-operations'
import { getProject } from '../server/services/projects'
import { listProjectRepositories } from '../server/services/repository-assets'

vi.mock('../server/services/projects', () => ({ getProject: vi.fn() }))
vi.mock('../server/services/repository-assets', () => ({ listProjectRepositories: vi.fn() }))
vi.mock('../server/services/environment-assets', () => ({ listProjectEnvironments: vi.fn() }))
vi.mock('../server/services/project-members', () => ({ listMembersForProject: vi.fn() }))
vi.mock('../server/services/knowledge-assets', () => ({ listProjectKnowledge: vi.fn() }))

describe('project asset listing boundary', () => {
  beforeEach(() => vi.resetAllMocks())

  test('rejects unknown commands without accessing a project', () => {
    expect(() => executeProjectAssetOperation('project-1', 'repository', 'repository.clone'))
      .toThrowError(expect.objectContaining({ data: { code: 'asset.operation-not-found' } }))
    expect(getProject).not.toHaveBeenCalled()
  })

  test('maps missing projects and storage failures to declared safe exceptions', () => {
    vi.mocked(getProject).mockImplementationOnce(() => { throw { statusCode: 404 } })
    expect(() => executeProjectAssetOperation('project-1', 'repository', 'repository.list'))
      .toThrowError(expect.objectContaining({ data: { code: 'asset.project-not-found' } }))
    expect(listProjectRepositories).not.toHaveBeenCalled()
    vi.mocked(listProjectRepositories).mockImplementationOnce(() => { throw new Error('private database detail') })
    expect(() => executeProjectAssetOperation('project-1', 'repository', 'repository.list'))
      .toThrowError(expect.objectContaining({ data: { code: 'asset.list-failed' }, statusMessage: '读取项目资产失败，请检查服务日志。' }))
  })
})

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { resolveAgentAssetContext } from '../server/services/agent-asset-context'
import { workflowAssetProjectId } from '../server/services/workflow-asset-resolution'
import { getRepositoryLocalCloneStatus } from '../server/services/repository-cloning'

vi.mock('../server/services/projects', () => ({ getProject: () => ({ id: 'project-1' }) }))
vi.mock('../server/services/workflow-asset-resolution', () => ({ workflowAssetProjectId: vi.fn(() => 'project-1') }))
vi.mock('../server/services/repository-cloning', () => ({ getRepositoryLocalCloneStatus: vi.fn() }))
vi.mock('../server/services/repository-assets', () => ({ getRepository: () => ({ name: 'repo', url: 'https://private-token@example.test/repo.git' }) }))
vi.mock('../server/services/knowledge-assets', () => ({ getKnowledge: () => ({ title: 'knowledge', content: 'explicit document', references: [{ recordId: 'unselected' }] }) }))
vi.mock('../server/services/environment-assets', () => ({ getEnvironment: () => ({ type: 'testing', note: '环境说明', address: 'https://user:private-password@example.test', accounts: [{ account: 'admin', password: 'private-password' }] }) }))
vi.mock('../server/services/project-members', () => ({ getProjectMember: () => ({ user: { name: 'member', email: 'private@email.test', passwordHash: 'private-hash' }, role: '开发' }) }))
vi.mock('../server/services/ai-interface-assets', () => ({ getAiInterface: () => ({ name: 'ai', provider: 'DeepSeek', encryptedApiKey: 'private-key', hasApiKey: true }) }))
beforeEach(() => {
  vi.mocked(workflowAssetProjectId).mockReset().mockReturnValue('project-1')
  vi.mocked(getRepositoryLocalCloneStatus).mockReset().mockResolvedValue({ repositoryId: 'repo', cloned: true, path: '/workspace/projects/project-1/repositories/repo' })
})

describe('explicit agent asset context', () => {
  test('supports every existing asset type without forwarding credentials or following extra references', async () => {
    const types = ['repository', 'knowledge', 'environment', 'member', 'ai-interface'] as const
    const context = await resolveAgentAssetContext('project-1', types.map(assetType => ({ assetType, assetId: assetType })))
    expect(context.repositories).toHaveLength(1)
    expect(JSON.parse(context.serialized)).toHaveLength(5)
    expect(context.serialized).toContain('/workspace/repositories/repository')
    expect(context.serialized).toContain('explicit document')
    expect(context.serialized).not.toMatch(/private-|password|email|encrypted|unselected|hasApiKey/)
  })
  test('rejects project mismatches and missing clones', async () => {
    vi.mocked(workflowAssetProjectId).mockReturnValueOnce('project-2')
    await expect(resolveAgentAssetContext('project-1', [{ assetType: 'knowledge', assetId: 'foreign' }])).rejects.toMatchObject({ data: { code: 'agent.asset-unavailable' } })
    vi.mocked(getRepositoryLocalCloneStatus).mockResolvedValueOnce({ repositoryId: 'repo', cloned: false, path: '/missing' })
    await expect(resolveAgentAssetContext('project-1', [{ assetType: 'repository', assetId: 'repo' }])).rejects.toMatchObject({ data: { code: 'agent.workspace-unavailable' } })
  })
})

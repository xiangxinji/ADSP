import type { AgentAssetReference } from '../../shared/types/agent-executors'
import type { AgentRepository } from '../domain/agent-executors'
import { createAssetOperationError } from '../utils/asset-operation-error'
import { getAiInterface } from './ai-interface-assets'
import { getEnvironment } from './environment-assets'
import { getKnowledge } from './knowledge-assets'
import { getProjectMember } from './project-members'
import { getProject } from './projects'
import { getRepository } from './repository-assets'
import { getRepositoryLocalCloneStatus } from './repository-cloning'
import { workflowAssetProjectId } from './workflow-asset-resolution'

export const validateAgentAssetReferences = (projectId: string, references: AgentAssetReference[]) => {
  try {
    getProject(projectId)
    for (const reference of references) {
      if (workflowAssetProjectId(reference.assetType, reference.assetId) !== projectId) throw new Error('Project mismatch')
    }
  } catch {
    throw createAssetOperationError(404, 'agent.asset-unavailable', '项目或引用资产不存在，或资产不属于当前项目。')
  }
}

export const resolveAgentAssetContext = async (projectId: string, references: AgentAssetReference[]) => {
  validateAgentAssetReferences(projectId, references)
  const repositories: AgentRepository[] = []
  const assets: Record<string, unknown>[] = []
  for (const reference of references) {
    const { assetType, assetId } = reference
    let context: Record<string, unknown>
    if (assetType === 'repository') {
      const repository = getRepository(assetId)
      try {
        const local = await getRepositoryLocalCloneStatus(assetId)
        if (!local.cloned) throw new Error('Not cloned')
        repositories.push({ assetId, name: repository.name, path: local.path })
      } catch {
        throw createAssetOperationError(409, 'agent.workspace-unavailable', '请先配置工作空间并克隆引用的仓库；仓库路径必须属于当前项目。')
      }
      context = { name: repository.name, directory: `/workspace/repositories/${assetId}` }
    } else if (assetType === 'knowledge') {
      const asset = getKnowledge(assetId)
      context = { title: asset.title, content: asset.content }
    } else if (assetType === 'environment') {
      const asset = getEnvironment(assetId)
      context = { type: asset.type, note: asset.note }
    } else if (assetType === 'member') {
      const asset = getProjectMember(assetId)
      context = { name: asset.user.name, role: asset.role }
    } else {
      const asset = getAiInterface(assetId)
      context = { name: asset.name, provider: asset.provider }
    }
    assets.push({ ...reference, ...context })
  }
  const serialized = JSON.stringify(assets)
  if (serialized.length > 128_000) throw createAssetOperationError(400, 'agent.invalid-input', '引用资产的上下文超过 128000 字符，请减少引用内容。')
  return { repositories, serialized }
}

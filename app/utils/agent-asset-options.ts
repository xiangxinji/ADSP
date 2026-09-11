import type { ProjectWorkspace } from '#shared/types/asdp'
import type { AgentAssetReference } from '#shared/types/agent-executors'

export const agentAssetOptions = (workspace: ProjectWorkspace): (AgentAssetReference & { label: string })[] => [
  ...workspace.repositories.map(asset => ({ assetType: 'repository' as const, assetId: asset.id, label: `仓库 · ${asset.name}` })),
  ...workspace.knowledge.map(asset => ({ assetType: 'knowledge' as const, assetId: asset.id, label: `知识 · ${asset.title}` })),
  ...workspace.environments.map(asset => ({ assetType: 'environment' as const, assetId: asset.id, label: `环境 · ${asset.note || asset.address}` })),
  ...workspace.members.map(asset => ({ assetType: 'member' as const, assetId: asset.id, label: `成员 · ${asset.user.name}` })),
  ...workspace.aiInterfaces.map(asset => ({ assetType: 'ai-interface' as const, assetId: asset.id, label: `AI 接口 · ${asset.name}` })),
]

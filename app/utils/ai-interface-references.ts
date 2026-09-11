import type { AiInterfaceAsset } from '#shared/types/ai-interfaces'
import type { KnowledgeAssetReferenceOption } from '../editor/knowledge-asset-reference'

export const aiInterfaceReferenceOptions = (assets: AiInterfaceAsset[]): KnowledgeAssetReferenceOption[] => assets.map(asset => ({
  targetType: 'ai-interface',
  typeLabel: 'AI 接口',
  recordId: asset.id,
  label: asset.name,
  detail: asset.provider,
}))

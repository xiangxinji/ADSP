import type {
  KnowledgeReference,
  KnowledgeReferenceType,
} from '../../shared/types/asdp'
import { findEnvironmentAsset } from '../repositories/environment-assets'
import { findKnowledgeAssetRecord } from '../repositories/knowledge-assets'
import { findProjectMember } from '../repositories/project-members'
import { findRepositoryAsset } from '../repositories/repository-assets'

const referenceTypeAliases: Record<string, KnowledgeReferenceType> = {
  repository: 'repository',
  repositories: 'repository',
  '代码仓库': 'repository',
  '仓库': 'repository',
  member: 'member',
  members: 'member',
  '项目成员': 'member',
  '成员': 'member',
  environment: 'environment',
  environments: 'environment',
  '项目环境': 'environment',
  '环境': 'environment',
  knowledge: 'knowledge',
  '知识': 'knowledge',
}

const resolveTarget = (targetType: KnowledgeReferenceType, recordId: string) => {
  if (targetType === 'repository') {
    const repository = findRepositoryAsset(recordId)
    return repository && { projectId: repository.projectId, label: repository.name }
  }
  if (targetType === 'member') {
    const member = findProjectMember(recordId)
    return member && { projectId: member.projectId, label: member.user.name }
  }
  if (targetType === 'environment') {
    const environment = findEnvironmentAsset(recordId)
    return environment && { projectId: environment.projectId, label: environment.address }
  }
  const knowledge = findKnowledgeAssetRecord(recordId)
  return knowledge && { projectId: knowledge.projectId, label: knowledge.title }
}

export const resolveKnowledgeReferences = (projectId: string, content: string): KnowledgeReference[] => {
  const references: KnowledgeReference[] = []
  const seen = new Set<string>()
  const pattern = /\[\[([^\[\]：:]+?)\s*[：:]\s*([^\[\]]+?)\]\]/g

  for (const match of content.matchAll(pattern)) {
    const assetType = match[1].trim()
    const recordId = match[2].trim()
    if (!assetType || !recordId) continue
    const targetType = referenceTypeAliases[assetType.toLowerCase()] || null
    const key = `${targetType || assetType}:${recordId}`
    if (seen.has(key)) continue
    seen.add(key)
    const target = targetType ? resolveTarget(targetType, recordId) : undefined
    const resolved = Boolean(target && target.projectId === projectId)
    references.push({
      assetType,
      targetType,
      recordId,
      label: resolved ? target!.label : null,
      resolved,
    })
  }

  return references
}

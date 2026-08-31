import { randomUUID } from 'node:crypto'
import type {
  CreateKnowledgeInput,
  KnowledgeAsset,
  UpdateKnowledgeInput,
} from '../../shared/types/asdp'
import {
  findKnowledgeAssetRecord,
  insertKnowledgeAssetRecord,
  listKnowledgeAssetRecords,
  removeKnowledgeAsset,
  type KnowledgeAssetRecord,
  updateKnowledgeAssetRecord,
} from '../repositories/knowledge-assets'
import { requireEntity } from './errors'
import { resolveKnowledgeReferences } from './knowledge-reference-resolver'
import { getProject } from './projects'

const getKnowledgeRecord = (id: string) => requireEntity(
  findKnowledgeAssetRecord(id),
  'Knowledge not found',
)

const hydrateKnowledge = (record: KnowledgeAssetRecord): KnowledgeAsset => ({
  ...record,
  references: resolveKnowledgeReferences(record.projectId, record.content),
})

export const getKnowledge = (id: string) => hydrateKnowledge(getKnowledgeRecord(id))

export const listProjectKnowledge = (projectId: string) => listKnowledgeAssetRecords(projectId)
  .map(hydrateKnowledge)

export const createKnowledge = (projectId: string, input: CreateKnowledgeInput) => {
  getProject(projectId)
  const timestamp = new Date().toISOString()
  const knowledge: KnowledgeAssetRecord = {
    id: randomUUID(),
    projectId,
    title: input.title,
    content: input.content,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  insertKnowledgeAssetRecord(knowledge)
  return getKnowledge(knowledge.id)
}

export const updateKnowledge = (id: string, input: UpdateKnowledgeInput) => {
  const current = getKnowledgeRecord(id)
  updateKnowledgeAssetRecord({
    ...current,
    title: input.title ?? current.title,
    content: input.content ?? current.content,
    updatedAt: new Date().toISOString(),
  })
  return getKnowledge(id)
}

export const deleteKnowledge = (id: string) => {
  getKnowledgeRecord(id)
  removeKnowledgeAsset(id)
}

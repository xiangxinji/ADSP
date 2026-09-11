import { randomUUID } from 'node:crypto'
import type { AiInterfaceAsset, CreateAiInterfaceInput, UpdateAiInterfaceInput } from '../../shared/types/ai-interfaces'
import type { AiInterfaceRecord } from '../domain/ai-interfaces'
import {
  findAiInterfaceAsset,
  insertAiInterfaceAsset,
  listAiInterfaceAssets,
  removeAiInterfaceAsset,
  removeProjectAiInterfaceAssets,
  updateAiInterfaceAssetRecord,
} from '../repositories/ai-interface-assets'
import { encryptCredential } from '../utils/credentials'
import { conflict, requireEntity } from './errors'
import { getProject } from './projects'

const getAiInterfaceRecord = (id: string) => requireEntity(findAiInterfaceAsset(id), 'AI interface not found')

const publicAiInterface = (asset: AiInterfaceRecord): AiInterfaceAsset => ({
  id: asset.id,
  projectId: asset.projectId,
  provider: asset.provider,
  name: asset.name,
  hasApiKey: Boolean(asset.encryptedApiKey),
  createdAt: asset.createdAt,
  updatedAt: asset.updatedAt,
})

const saveAiInterface = (persist: () => void) => {
  try {
    persist()
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: ai_interface_assets.project_id, ai_interface_assets.name')) {
      throw conflict('An AI interface with this name already exists in the project')
    }
    throw error
  }
}

export const getAiInterface = (id: string) => publicAiInterface(getAiInterfaceRecord(id))

export const listProjectAiInterfaces = (projectId: string) => {
  getProject(projectId)
  return listAiInterfaceAssets(projectId).map(publicAiInterface)
}

export const createAiInterface = (projectId: string, input: CreateAiInterfaceInput) => {
  getProject(projectId)
  const timestamp = new Date().toISOString()
  const asset: AiInterfaceRecord = {
    id: randomUUID(),
    projectId,
    provider: input.provider,
    name: input.name,
    encryptedApiKey: encryptCredential(input.apiKey),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  saveAiInterface(() => insertAiInterfaceAsset(asset))
  return publicAiInterface(asset)
}

export const updateAiInterface = (id: string, input: UpdateAiInterfaceInput) => {
  const current = getAiInterfaceRecord(id)
  const asset: AiInterfaceRecord = {
    ...current,
    provider: input.provider ?? current.provider,
    name: input.name ?? current.name,
    encryptedApiKey: input.apiKey === undefined ? current.encryptedApiKey : encryptCredential(input.apiKey),
    updatedAt: new Date().toISOString(),
  }
  saveAiInterface(() => updateAiInterfaceAssetRecord(asset))
  return publicAiInterface(asset)
}

export const deleteAiInterface = (id: string) => {
  getAiInterfaceRecord(id)
  removeAiInterfaceAsset(id)
}

export const deleteProjectAiInterfaces = (projectId: string) => removeProjectAiInterfaceAssets(projectId)

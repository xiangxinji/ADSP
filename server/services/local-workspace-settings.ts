import { constants } from 'node:fs'
import { access, mkdir, realpath, stat } from 'node:fs/promises'
import { createError } from 'h3'
import type { LocalWorkspaceSettings } from '../../shared/types/asdp'
import {
  findLocalWorkspaceSettingsRecord,
  upsertLocalWorkspaceSettingsRecord,
} from '../repositories/local-workspace-settings'
import {
  InvalidWorkspacePathError,
  normalizeWorkspaceRoot,
  resolveProjectWorkspacePath,
  resolveWithinWorkspace,
} from '../utils/workspace-path'

const settingsFromRecord = (): LocalWorkspaceSettings => {
  const record = findLocalWorkspaceSettingsRecord()
  return record
    ? { path: record.path, configured: true, updatedAt: record.updatedAt }
    : { path: null, configured: false, updatedAt: null }
}

const invalidWorkspaceError = (error: unknown) => {
  if (error instanceof InvalidWorkspacePathError) {
    return createError({ statusCode: 400, statusMessage: error.message })
  }
  return createError({
    statusCode: 400,
    statusMessage: '无法创建或写入该目录，请检查路径和系统权限',
  })
}

export const getLocalWorkspaceSettings = () => settingsFromRecord()

export const updateLocalWorkspaceSettings = async (input: { path: string }) => {
  let canonicalPath: string
  try {
    const normalizedPath = normalizeWorkspaceRoot(input.path)
    await mkdir(normalizedPath, { recursive: true })
    const workspaceStat = await stat(normalizedPath)
    if (!workspaceStat.isDirectory()) {
      throw new InvalidWorkspacePathError('工作空间路径必须指向一个目录')
    }
    await access(normalizedPath, constants.R_OK | constants.W_OK | constants.X_OK)
    canonicalPath = normalizeWorkspaceRoot(await realpath(normalizedPath))
  } catch (error) {
    throw invalidWorkspaceError(error)
  }
  const timestamp = new Date().toISOString()
  const existing = findLocalWorkspaceSettingsRecord()
  upsertLocalWorkspaceSettingsRecord({
    path: canonicalPath,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  })
  return settingsFromRecord()
}

export const requireLocalWorkspaceRoot = () => {
  const settings = settingsFromRecord()
  if (!settings.path) {
    throw createError({ statusCode: 409, statusMessage: '请先在全局设置中配置本地工作空间' })
  }
  return settings.path
}

export const resolveLocalWorkspacePath = (...segments: string[]) => {
  try {
    return resolveWithinWorkspace(requireLocalWorkspaceRoot(), ...segments)
  } catch (error) {
    if (error instanceof InvalidWorkspacePathError) throw invalidWorkspaceError(error)
    throw error
  }
}

export const resolveLocalProjectWorkspacePath = (projectId: string, ...segments: string[]) => {
  try {
    return resolveProjectWorkspacePath(requireLocalWorkspaceRoot(), projectId, ...segments)
  } catch (error) {
    if (error instanceof InvalidWorkspacePathError) throw invalidWorkspaceError(error)
    throw error
  }
}

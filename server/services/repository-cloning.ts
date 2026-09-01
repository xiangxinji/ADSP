import { lstat, mkdir, realpath } from 'node:fs/promises'
import { relative } from 'node:path'
import { createError } from 'h3'
import type { RepositoryCloneResult, RepositoryUpdateResult } from '../../shared/types/asdp'
import { cloneGitRepository, updateGitRepository } from '../integrations/git'
import { resolveWithinWorkspace } from '../utils/workspace-path'
import { conflict } from './errors'
import { getStoredGitLabCredentials } from './gitlab'
import {
  requireLocalWorkspaceRoot,
  resolveLocalWorkspacePath,
} from './local-workspace-settings'
import { getRepository } from './repository-assets'

const windowsReservedName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

const repositoryDirectoryName = (repositoryUrl: string) => {
  let url: URL
  try {
    url = new URL(repositoryUrl)
  } catch {
    throw createError({ statusCode: 400, statusMessage: '仓库地址无效，无法确定克隆目录' })
  }
  if (url.password) {
    throw createError({ statusCode: 400, statusMessage: '仓库地址不能包含密码或 Token' })
  }

  const encodedName = url.pathname.split('/').filter(Boolean).at(-1) || ''
  let name: string
  try {
    name = decodeURIComponent(encodedName).replace(/\.git$/i, '')
  } catch {
    throw createError({ statusCode: 400, statusMessage: '仓库地址包含无效的路径编码' })
  }

  if (!name
    || name === '.'
    || name === '..'
    || name.length > 255
    || /[<>:"/\\|?*\u0000-\u001f]/.test(name)
    || /[. ]$/.test(name)
    || windowsReservedName.test(name)) {
    throw createError({ statusCode: 400, statusMessage: '仓库地址无法生成安全的本地目录名' })
  }
  return name
}

const pathStat = async (path: string) => {
  try {
    return await lstat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

const cloneAuthorization = (repositoryUrl: string) => {
  const credentials = getStoredGitLabCredentials()
  if (!credentials) return undefined

  const repositoryOrigin = new URL(repositoryUrl).origin
  const gitLabOrigin = new URL(credentials.baseUrl).origin
  if (repositoryOrigin !== gitLabOrigin || !['http:', 'https:'].includes(new URL(repositoryUrl).protocol)) {
    return undefined
  }
  return credentials
}

export const cloneRepository = async (id: string): Promise<RepositoryCloneResult> => {
  const repository = getRepository(id)
  const workspaceRoot = requireLocalWorkspaceRoot()
  const repositoriesRoot = resolveLocalWorkspacePath(repository.projectId, 'repositories')
  await mkdir(repositoriesRoot, { recursive: true })
  const repositoriesRootStat = await pathStat(repositoriesRoot)
  if (!repositoriesRootStat?.isDirectory() || repositoriesRootStat.isSymbolicLink()) {
    throw conflict('项目 repositories 路径不是可用的仓库目录')
  }

  const canonicalWorkspaceRoot = await realpath(workspaceRoot)
  const canonicalRepositoriesRoot = await realpath(repositoriesRoot)
  resolveWithinWorkspace(
    canonicalWorkspaceRoot,
    relative(canonicalWorkspaceRoot, canonicalRepositoriesRoot),
  )

  const destination = resolveWithinWorkspace(
    canonicalRepositoriesRoot,
    repositoryDirectoryName(repository.url),
  )
  const destinationStat = await pathStat(destination)
  const authorization = repository.provider === 'gitlab'
    ? cloneAuthorization(repository.url)
    : undefined

  if (destinationStat) {
    throw conflict(`本地目录已存在：${destination}`)
  }

  await cloneGitRepository({
    url: repository.url,
    destination,
    authorization,
  })
  return { repositoryId: repository.id, path: destination }
}

export const updateRepositoryWorkingCopy = async (id: string): Promise<RepositoryUpdateResult> => {
  const repository = getRepository(id)
  const workspaceRoot = requireLocalWorkspaceRoot()
  const repositoriesRoot = resolveLocalWorkspacePath(repository.projectId, 'repositories')
  const repositoriesRootStat = await pathStat(repositoriesRoot)
  if (!repositoriesRootStat?.isDirectory() || repositoriesRootStat.isSymbolicLink()) {
    throw conflict('项目 repositories 目录不存在，请先克隆仓库')
  }

  const canonicalWorkspaceRoot = await realpath(workspaceRoot)
  const canonicalRepositoriesRoot = await realpath(repositoriesRoot)
  resolveWithinWorkspace(
    canonicalWorkspaceRoot,
    relative(canonicalWorkspaceRoot, canonicalRepositoriesRoot),
  )

  const destination = resolveWithinWorkspace(
    canonicalRepositoriesRoot,
    repositoryDirectoryName(repository.url),
  )
  const destinationStat = await pathStat(destination)
  if (!destinationStat?.isDirectory() || destinationStat.isSymbolicLink()) {
    throw conflict(`对应仓库目录不存在，请先克隆：${destination}`)
  }

  const canonicalDestination = await realpath(destination)
  resolveWithinWorkspace(
    canonicalRepositoriesRoot,
    relative(canonicalRepositoriesRoot, canonicalDestination),
  )
  await updateGitRepository({
    directory: canonicalDestination,
    expectedUrl: repository.url,
    authorization: repository.provider === 'gitlab'
      ? cloneAuthorization(repository.url)
      : undefined,
  })
  return { repositoryId: repository.id, path: destination }
}

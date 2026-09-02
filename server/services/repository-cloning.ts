import { lstat, mkdir, realpath } from 'node:fs/promises'
import { relative } from 'node:path'
import { createError } from 'h3'
import type {
  RepositoryCloneResult,
  RepositoryLocalCloneStatusResult,
  RepositoryUpdateResult,
  RepositoryWorktreeResult,
} from '../../shared/types/asdp'
import {
  cloneGitRepository,
  createGitWorktree,
  hasGitRepositoryWorkingCopy,
  updateGitRepository,
} from '../integrations/git'
import { resolveWithinWorkspace } from '../utils/workspace-path'
import { conflict } from './errors'
import { getStoredGitLabCredentials } from './gitlab'
import {
  requireLocalWorkspaceRoot,
  resolveLocalProjectWorkspacePath,
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

type RepositoryWorkingCopyLocation = {
  destination: string
  canonicalRepositoriesRoot: string | null
}

const resolveRepositoryWorkingCopyLocation = async (
  repository: ReturnType<typeof getRepository>,
  createRepositoriesRoot = false,
): Promise<RepositoryWorkingCopyLocation> => {
  const workspaceRoot = requireLocalWorkspaceRoot()
  const repositoryName = repositoryDirectoryName(repository.url)
  const projectRoot = resolveLocalProjectWorkspacePath(repository.projectId)
  const repositoriesRoot = resolveLocalProjectWorkspacePath(repository.projectId, 'repositories')
  if (createRepositoriesRoot) await mkdir(repositoriesRoot, { recursive: true })

  const destination = resolveWithinWorkspace(repositoriesRoot, repositoryName)
  const projectRootStat = await pathStat(projectRoot)
  const repositoriesRootStat = await pathStat(repositoriesRoot)
  if (!projectRootStat?.isDirectory()
    || projectRootStat.isSymbolicLink()
    || !repositoriesRootStat?.isDirectory()
    || repositoriesRootStat.isSymbolicLink()) {
    return { destination, canonicalRepositoriesRoot: null }
  }

  const canonicalWorkspaceRoot = await realpath(workspaceRoot)
  const canonicalProjectRoot = await realpath(projectRoot)
  const canonicalRepositoriesRoot = await realpath(repositoriesRoot)
  resolveWithinWorkspace(
    canonicalWorkspaceRoot,
    relative(canonicalWorkspaceRoot, canonicalProjectRoot),
  )
  resolveWithinWorkspace(
    canonicalProjectRoot,
    relative(canonicalProjectRoot, canonicalRepositoriesRoot),
  )
  return {
    destination: resolveWithinWorkspace(canonicalRepositoriesRoot, repositoryName),
    canonicalRepositoriesRoot,
  }
}

const worktreeDirectoryName = (repositoryUrl: string, branch: string) => {
  const name = `${repositoryDirectoryName(repositoryUrl)}_${branch.replaceAll('/', '-')}`
  if (name.length > 255) {
    throw createError({ statusCode: 400, statusMessage: 'branch 生成的工作树目录名称过长' })
  }
  return name
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
  const location = await resolveRepositoryWorkingCopyLocation(repository, true)
  if (!location.canonicalRepositoriesRoot) {
    throw conflict('项目 repositories 路径不是可用的仓库目录')
  }
  const destinationStat = await pathStat(location.destination)
  const authorization = repository.provider === 'gitlab'
    ? cloneAuthorization(repository.url)
    : undefined

  if (destinationStat) {
    throw conflict(`本地目录已存在：${location.destination}`)
  }

  await cloneGitRepository({
    url: repository.url,
    destination: location.destination,
    authorization,
  })
  return { repositoryId: repository.id, path: location.destination }
}

export const updateRepositoryWorkingCopy = async (id: string): Promise<RepositoryUpdateResult> => {
  const repository = getRepository(id)
  const location = await resolveRepositoryWorkingCopyLocation(repository)
  if (!location.canonicalRepositoriesRoot) {
    throw conflict('项目 repositories 目录不存在，请先克隆仓库')
  }
  const destinationStat = await pathStat(location.destination)
  if (!destinationStat?.isDirectory() || destinationStat.isSymbolicLink()) {
    throw conflict(`对应仓库目录不存在，请先克隆：${location.destination}`)
  }

  const canonicalDestination = await realpath(location.destination)
  resolveWithinWorkspace(
    location.canonicalRepositoriesRoot,
    relative(location.canonicalRepositoriesRoot, canonicalDestination),
  )
  await updateGitRepository({
    directory: canonicalDestination,
    expectedUrl: repository.url,
    authorization: repository.provider === 'gitlab'
      ? cloneAuthorization(repository.url)
      : undefined,
  })
  return { repositoryId: repository.id, path: location.destination }
}

export const getRepositoryLocalCloneStatus = async (id: string): Promise<RepositoryLocalCloneStatusResult> => {
  const repository = getRepository(id)
  const location = await resolveRepositoryWorkingCopyLocation(repository)
  if (!location.canonicalRepositoriesRoot) {
    return { repositoryId: repository.id, cloned: false, path: location.destination }
  }

  const destinationStat = await pathStat(location.destination)
  if (!destinationStat?.isDirectory() || destinationStat.isSymbolicLink()) {
    return { repositoryId: repository.id, cloned: false, path: location.destination }
  }

  const canonicalDestination = await realpath(location.destination)
  resolveWithinWorkspace(
    location.canonicalRepositoriesRoot,
    relative(location.canonicalRepositoriesRoot, canonicalDestination),
  )
  const cloned = await hasGitRepositoryWorkingCopy({
    directory: canonicalDestination,
    expectedUrl: repository.url,
  })
  return { repositoryId: repository.id, cloned, path: location.destination }
}

export const createRepositoryWorktree = async (
  id: string,
  branch: string,
): Promise<RepositoryWorktreeResult> => {
  const repository = getRepository(id)
  const worktreeName = worktreeDirectoryName(repository.url, branch)
  const location = await resolveRepositoryWorkingCopyLocation(repository)
  if (!location.canonicalRepositoriesRoot) {
    throw conflict('项目 repositories 目录不存在，请先克隆仓库')
  }

  const destinationStat = await pathStat(location.destination)
  if (!destinationStat?.isDirectory() || destinationStat.isSymbolicLink()) {
    throw conflict(`对应仓库目录不存在，请先克隆：${location.destination}`)
  }

  const canonicalDestination = await realpath(location.destination)
  resolveWithinWorkspace(
    location.canonicalRepositoriesRoot,
    relative(location.canonicalRepositoriesRoot, canonicalDestination),
  )

  const worktreesRoot = resolveWithinWorkspace(location.canonicalRepositoriesRoot, 'worktrees')
  await mkdir(worktreesRoot, { recursive: true })
  const worktreesRootStat = await pathStat(worktreesRoot)
  if (!worktreesRootStat?.isDirectory() || worktreesRootStat.isSymbolicLink()) {
    throw conflict('项目 worktrees 路径不是可用的仓库目录')
  }

  const canonicalWorktreesRoot = await realpath(worktreesRoot)
  resolveWithinWorkspace(
    location.canonicalRepositoriesRoot,
    relative(location.canonicalRepositoriesRoot, canonicalWorktreesRoot),
  )
  const worktreePath = resolveWithinWorkspace(
    canonicalWorktreesRoot,
    worktreeName,
  )
  if (await pathStat(worktreePath)) {
    throw conflict(`工作树目录已存在：${worktreePath}`)
  }

  await createGitWorktree({
    directory: canonicalDestination,
    destination: worktreePath,
    expectedUrl: repository.url,
    branch,
    authorization: repository.provider === 'gitlab'
      ? cloneAuthorization(repository.url)
      : undefined,
  })
  return { repositoryId: repository.id, branch, path: worktreePath }
}

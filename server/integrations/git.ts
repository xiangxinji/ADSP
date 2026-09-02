import { spawn } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { createAssetOperationError } from '../utils/asset-operation-error'

type GitHttpAuthorization = {
  baseUrl: string
  token: string
}

type GitCommandOptions = {
  authorization?: GitHttpAuthorization
}

type CloneGitRepositoryOptions = GitCommandOptions & {
  url: string
  destination: string
}

type UpdateGitRepositoryOptions = GitCommandOptions & {
  directory: string
  expectedUrl: string
}

type CreateGitWorktreeOptions = UpdateGitRepositoryOptions & {
  branch: string
  destination: string
}

type GitRepositoryVerificationMessages = {
  missing: {
    code: string
    message: string
  }
  mismatched: {
    code: string
    message: string
  }
}

const gitErrorDetail = (value: string, secrets: string[]) => {
  const redacted = secrets.reduce((result, secret) => result.replaceAll(secret, '[REDACTED]'), value)
  return redacted
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .at(-1)
    ?.replace(/^fatal:\s*/i, '') || '请检查仓库地址、访问权限和网络连接'
}

const gitEnvironment = (authorization?: GitHttpAuthorization) => {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
  }
  const secrets: string[] = []

  if (authorization) {
    const header = `Basic ${Buffer.from(`oauth2:${authorization.token}`).toString('base64')}`
    environment.GIT_CONFIG_COUNT = '1'
    environment.GIT_CONFIG_KEY_0 = `http.${authorization.baseUrl.replace(/\/$/, '')}/.extraHeader`
    environment.GIT_CONFIG_VALUE_0 = `Authorization: ${header}`
    secrets.push(authorization.token, header)
  }

  return { environment, secrets }
}

const runGit = (arguments_: string[], options: GitCommandOptions = {}) => new Promise<string>((resolve, reject) => {
  const { environment, secrets } = gitEnvironment(options.authorization)

  const child = spawn('git', arguments_, {
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let standardOutput = ''
  let standardError = ''

  child.stdout.on('data', chunk => {
    standardOutput = `${standardOutput}${String(chunk)}`.slice(-16_384)
  })
  child.stderr.on('data', chunk => {
    standardError = `${standardError}${String(chunk)}`.slice(-16_384)
  })
  child.on('error', error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      reject(createAssetOperationError(500, 'repository.git-unavailable', '未检测到 Git，请先在 ForgePilot 运行环境中安装 Git'))
      return
    }
    reject(createAssetOperationError(500, 'repository.git-command-failed', '无法启动 Git 进程', error))
  })
  child.on('close', code => {
    if (code === 0) {
      resolve(standardOutput.trim())
      return
    }
    reject(createAssetOperationError(
      502,
      'repository.git-command-failed',
      `Git 命令执行失败：${gitErrorDetail(standardError, secrets)}`,
    ))
  })
})

const normalizedRemoteUrl = (value: string) => value.trim().replace(/\/+$/, '').replace(/\.git$/i, '')

const originUrl = async (options: UpdateGitRepositoryOptions) => {
  try {
    return await runGit(['-C', options.directory, 'remote', 'get-url', 'origin'])
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 500) throw error
    return null
  }
}

const assertMatchingGitRepository = async (
  options: UpdateGitRepositoryOptions,
  messages: GitRepositoryVerificationMessages = {
    missing: { code: 'repository.local-copy-missing', message: '对应目录不是可用的 Git 仓库' },
    mismatched: { code: 'repository.remote-mismatch', message: '对应目录的 origin 与当前仓库资产不一致，已停止操作' },
  },
) => {
  const value = await originUrl(options)
  if (!value) {
    throw createAssetOperationError(409, messages.missing.code, messages.missing.message)
  }
  if (normalizedRemoteUrl(value) !== normalizedRemoteUrl(options.expectedUrl)) {
    throw createAssetOperationError(409, messages.mismatched.code, messages.mismatched.message)
  }
}

const gitRefExists = async (directory: string, ref: string, options: GitCommandOptions) => {
  try {
    await runGit(['-C', directory, 'show-ref', '--verify', '--quiet', ref], options)
    return true
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 500) throw error
    return false
  }
}

export const cloneGitRepository = async (options: CloneGitRepositoryOptions) => {
  await runGit(['clone', '--', options.url, options.destination], options)
}

export const updateGitRepository = async (options: UpdateGitRepositoryOptions) => {
  await assertMatchingGitRepository(options, {
    missing: { code: 'repository.local-copy-missing', message: '对应目录不是可更新的 Git 仓库' },
    mismatched: { code: 'repository.remote-mismatch', message: '对应目录的 origin 与当前仓库资产不一致，已停止更新' },
  })

  await runGit(['-C', options.directory, 'remote', 'update', '--prune'], options)
  await runGit(['-C', options.directory, 'pull', '--ff-only'], options)
}

export const hasGitRepositoryWorkingCopy = async (options: UpdateGitRepositoryOptions) => {
  const value = await originUrl(options)
  return Boolean(value && normalizedRemoteUrl(value) === normalizedRemoteUrl(options.expectedUrl))
}

export const createGitWorktree = async (options: CreateGitWorktreeOptions) => {
  await assertMatchingGitRepository(options)
  await runGit(['-C', options.directory, 'fetch', '--prune', 'origin'], options)

  if (await gitRefExists(options.directory, `refs/heads/${options.branch}`, options)) {
    await runGit(['-C', options.directory, 'worktree', 'add', options.destination, options.branch], options)
    return
  }

  if (await gitRefExists(options.directory, `refs/remotes/origin/${options.branch}`, options)) {
    await runGit([
      '-C', options.directory,
      'worktree', 'add', '--track', '-b', options.branch,
      options.destination,
      `origin/${options.branch}`,
    ], options)
    return
  }

  throw createAssetOperationError(404, 'repository.branch-not-found', `指定分支不存在：${options.branch}`)
}

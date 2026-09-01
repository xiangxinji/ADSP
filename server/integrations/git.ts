import { spawn } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { createError } from 'h3'

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
      reject(createError({ statusCode: 500, statusMessage: '未检测到 Git，请先在 ForgePilot 运行环境中安装 Git' }))
      return
    }
    reject(createError({ statusCode: 500, statusMessage: '无法启动 Git 进程', cause: error }))
  })
  child.on('close', code => {
    if (code === 0) {
      resolve(standardOutput.trim())
      return
    }
    reject(createError({
      statusCode: 502,
      statusMessage: `Git 命令执行失败：${gitErrorDetail(standardError, secrets)}`,
    }))
  })
})

const normalizedRemoteUrl = (value: string) => value.trim().replace(/\/+$/, '').replace(/\.git$/i, '')

export const cloneGitRepository = async (options: CloneGitRepositoryOptions) => {
  await runGit(['clone', '--', options.url, options.destination], options)
}

export const updateGitRepository = async (options: UpdateGitRepositoryOptions) => {
  let originUrl: string
  try {
    originUrl = await runGit(['-C', options.directory, 'remote', 'get-url', 'origin'])
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 500) throw error
    throw createError({ statusCode: 409, statusMessage: '对应目录不是可更新的 Git 仓库' })
  }

  if (normalizedRemoteUrl(originUrl) !== normalizedRemoteUrl(options.expectedUrl)) {
    throw createError({ statusCode: 409, statusMessage: '对应目录的 origin 与当前仓库资产不一致，已停止更新' })
  }

  await runGit(['-C', options.directory, 'remote', 'update', '--prune'], options)
  await runGit(['-C', options.directory, 'pull', '--ff-only'], options)
}

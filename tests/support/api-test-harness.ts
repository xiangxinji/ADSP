import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

export type ApiResponse<T> = {
  data: T
  headers: Headers
  status: number
}

export type GitLabRequest = {
  pathname: string
  query: Record<string, string>
  token: string
}

export type ApiTestHarness = {
  baseUrl: string
  gitLabBaseUrl: string
  gitLabRequests: GitLabRequest[]
  request: <T>(path: string, options?: ApiRequestOptions) => Promise<ApiResponse<T>>
  stop: () => Promise<void>
}

const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))

const closeServer = (server: Server) => new Promise<void>((resolve, reject) => {
  server.close(error => error ? reject(error) : resolve())
})

const listen = async (server: Server) => {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Unable to allocate a test port')
  return address.port
}

const availablePort = async () => {
  const server = createServer()
  const port = await listen(server)
  await closeServer(server)
  return port
}

const startGitLabMock = async () => {
  const requests: GitLabRequest[] = []
  const server = createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`)
    const token = String(request.headers['private-token'] || '')
    requests.push({
      pathname: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      token,
    })

    response.setHeader('Content-Type', 'application/json')
    if (token !== 'valid-token') {
      response.statusCode = 401
      response.end(JSON.stringify({ message: '401 Unauthorized' }))
      return
    }

    if (url.pathname === '/api/v4/user') {
      response.end(JSON.stringify({ id: 42, name: 'ForgePilot Tester', username: 'forgepilot-tester' }))
      return
    }

    if (url.pathname === '/api/v4/projects') {
      response.setHeader('X-Total', '1')
      response.setHeader('X-Next-Page', '')
      response.end(JSON.stringify([{
        id: 101,
        name: 'forgepilot-api',
        name_with_namespace: 'ForgePilot / forgepilot-api',
        web_url: 'https://gitlab.example.com/forgepilot/forgepilot-api',
        http_url_to_repo: 'https://gitlab.example.com/forgepilot/forgepilot-api.git',
        default_branch: 'main',
        visibility: 'private',
        archived: false,
      }]))
      return
    }

    response.statusCode = 404
    response.end(JSON.stringify({ message: 'Not found' }))
  })
  const port = await listen(server)
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    stop: () => closeServer(server),
  }
}

const waitForAsdp = async (process: ChildProcess, baseUrl: string, output: string[]) => {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`ForgePilot test server exited during startup:\n${output.join('')}`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/projects`)
      if (response.ok) return
    } catch {
      // The server may not have bound its port yet.
    }
    await delay(100)
  }
  throw new Error(`Timed out waiting for ForgePilot test server:\n${output.join('')}`)
}

const stopProcess = async (process: ChildProcess) => {
  if (process.exitCode !== null || process.signalCode !== null) return
  const exited = once(process, 'exit')
  process.kill()
  const didExit = await Promise.race([
    exited.then(() => true),
    delay(5_000).then(() => false),
  ])
  if (!didExit) {
    process.kill('SIGKILL')
    await once(process, 'exit')
  }
}

export const startApiTestHarness = async (): Promise<ApiTestHarness> => {
  const testDirectory = await mkdtemp(join(tmpdir(), 'forgepilot-api-test-'))
  let gitLab: Awaited<ReturnType<typeof startGitLabMock>> | undefined
  let child: ChildProcess | undefined
  const serverOutput: string[] = []

  try {
    gitLab = await startGitLabMock()
    const port = await availablePort()
    const baseUrl = `http://127.0.0.1:${port}`
    child = spawn(process.execPath, [join(process.cwd(), '.output', 'server', 'index.mjs')], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ASDP_CREDENTIAL_ENCRYPTION_KEY: 'asdp-api-test-key',
        ASDP_DB_PATH: join(testDirectory, 'asdp.sqlite'),
        HOST: '127.0.0.1',
        NODE_ENV: 'test',
        PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    child.stdout?.on('data', chunk => serverOutput.push(String(chunk)))
    child.stderr?.on('data', chunk => serverOutput.push(String(chunk)))
    await waitForAsdp(child, baseUrl, serverOutput)
    const activeChild = child
    const activeGitLab = gitLab

    let stopped = false
    return {
      baseUrl,
      gitLabBaseUrl: activeGitLab.baseUrl,
      gitLabRequests: activeGitLab.requests,
      request: async <T>(path: string, options: ApiRequestOptions = {}) => {
        const headers = new Headers(options.headers)
        if (options.body !== undefined) headers.set('Content-Type', 'application/json')
        const response = await fetch(`${baseUrl}${path}`, {
          ...options,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          headers,
        })
        const text = await response.text()
        return {
          data: (text ? JSON.parse(text) : null) as T,
          headers: response.headers,
          status: response.status,
        }
      },
      stop: async () => {
        if (stopped) return
        stopped = true
        await stopProcess(activeChild)
        await activeGitLab.stop()
        await rm(testDirectory, { recursive: true, force: true })
      },
    }
  } catch (error) {
    if (child) await stopProcess(child)
    if (gitLab) await gitLab.stop()
    await rm(testDirectory, { recursive: true, force: true })
    throw error
  }
}

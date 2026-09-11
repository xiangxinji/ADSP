import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { AgentRunnerRequest } from '../domain/agent-executors'
import { createAssetOperationError } from '../utils/asset-operation-error'
import { parseAgentOutput } from './agent-output'

export const agentTimeoutMs = 600_000
const outputLimit = 2 * 1024 * 1024

export const agentContainerArguments = (request: AgentRunnerRequest, name: string, image: string) => {
  const credentialName = request.executor === 'codex' ? 'CODEX_API_KEY' : 'ANTHROPIC_API_KEY'
  const mount = ['type=bind', `"source=${request.directory.replaceAll('"', '""')}"`, 'target=/workspace', ...(!request.writable ? ['readonly'] : [])].join(',')
  const common = [
    'run', '--rm', '--init', '--pull=never', '--name', name,
    '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges:true', '--pids-limit=128', '--memory=2g', '--cpus=2',
    '--user=1000:1000', '--tmpfs', '/home/agent:rw,uid=1000,gid=1000,mode=0700,size=128m',
    '--tmpfs', '/tmp:rw,nosuid,size=256m', '--workdir=/home/agent', '--mount', mount,
    '--env', 'HOME=/home/agent', '--env', 'CODEX_HOME=/home/agent/.codex', '--env', 'CLAUDE_CONFIG_DIR=/home/agent/.claude',
    '--env', credentialName, '--interactive', image, 'timeout', '--signal=TERM', '--kill-after=5s', '600s',
  ]
  if (request.executor === 'codex') return [...common,
    'codex', 'exec', '--json', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check',
    '--sandbox', request.writable ? 'workspace-write' : 'read-only',
    '-c', 'approval_policy="never"', '-c', 'web_search="disabled"',
    '-c', 'sandbox_workspace_write.network_access=false', '-c', 'shell_environment_policy.inherit="core"',
    ...(request.writable ? ['--add-dir', '/workspace'] : []), '-',
  ]
  const tools = request.writable ? 'Read,Glob,Grep,Edit,Write' : 'Read,Glob,Grep'
  return [...common,
    'claude', '-p', '--bare', '--output-format=json', '--no-session-persistence', '--permission-mode=default',
    '--tools', tools, '--allowedTools', tools, '--add-dir', '/workspace',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
  ]
}

const dockerCommand = () => {
  try {
    const command = JSON.parse(process.env.FORGEPILOT_AGENT_DOCKER_COMMAND || '["docker"]')
    if (!Array.isArray(command) || !command.length || command.some(value => typeof value !== 'string' || !value)) throw new Error('Invalid command')
    return command as string[]
  } catch {
    throw createAssetOperationError(503, 'agent.runner-unavailable', 'Docker 启动命令配置无效。')
  }
}

export const runAgentContainer = async (request: AgentRunnerRequest) => {
  const credentialName = request.executor === 'codex' ? 'CODEX_API_KEY' : 'ANTHROPIC_API_KEY'
  const credential = request.executor === 'codex' ? process.env.FORGEPILOT_CODEX_API_KEY : process.env.FORGEPILOT_CLAUDE_API_KEY
  if (!credential?.trim()) throw createAssetOperationError(409, 'agent.authentication-required', '请在服务端配置对应执行器的专用 API Key。')
  const command = dockerCommand()
  const name = `forgepilot-agent-${randomUUID()}`
  const args = agentContainerArguments(request, name, process.env.FORGEPILOT_AGENT_IMAGE || 'forgepilot-agent-runner:local')
  const environment: NodeJS.ProcessEnv = {}
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) {
    if (process.env[key]) environment[key] = process.env[key]
  }
  environment[credentialName] = credential
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(command[0]!, [...command.slice(1), ...args], { env: environment, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let bytes = 0
    let settled = false
    let failure: ReturnType<typeof createAssetOperationError> | undefined
    let cleanup: Promise<void> | undefined
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve(stdout)
    }
    const terminate = (code: string, message: string) => {
      if (failure || settled) return
      failure = createAssetOperationError(502, code, message)
      cleanup = new Promise<void>(done => {
        const remover = spawn(command[0]!, [...command.slice(1), 'rm', '--force', name], { env: environment, windowsHide: true, shell: false, stdio: 'ignore', timeout: 10_000 })
        const stop = () => { child.kill(); done() }
        remover.once('error', stop)
        remover.once('close', stop)
      })
    }
    const timer = setTimeout(() => terminate('agent.timeout', '智能体执行超过 10 分钟，已请求终止容器。'), agentTimeoutMs)
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      bytes += Buffer.byteLength(chunk)
      if (bytes > outputLimit) terminate('agent.output-invalid', '执行器输出超过 2 MiB 限制，已请求终止容器。')
      else stdout += chunk
    })
    child.stderr.on('data', (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > outputLimit) terminate('agent.output-invalid', '执行器输出超过限制，已请求终止容器。')
    })
    child.once('error', () => finish(createAssetOperationError(503, 'agent.runner-unavailable', '无法启动 Docker，请检查本机执行环境。')))
    child.stdin.on('error', () => {})
    child.once('close', async code => {
      if (cleanup) await cleanup
      if (failure) return finish(failure)
      if (code === 124 || code === 137) return finish(createAssetOperationError(504, 'agent.timeout', '执行超时或超过容器资源限制。'))
      if ([125, 126, 127].includes(code!)) return finish(createAssetOperationError(503, 'agent.runner-unavailable', 'Docker 引擎或 forgepilot-agent-runner 镜像不可用，请检查部署配置。'))
      if (code !== 0) return finish(createAssetOperationError(502, 'agent.execution-failed', '执行器调用失败，请检查凭据、模型服务和沙箱支持。'))
      finish()
    })
    child.stdin.end(request.prompt)
  })
  const text = parseAgentOutput(request.executor, output).replaceAll(credential, '[REDACTED]')
  if (text.length > 120_000) throw createAssetOperationError(502, 'agent.output-invalid', '智能体最终输出超过 120000 字符。')
  return text
}

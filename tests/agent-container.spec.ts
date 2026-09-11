import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { runAgentContainer, agentTimeoutMs } from '../server/integrations/agent-container'

const request = { executor: 'codex' as const, writable: false, prompt: '调研', directory: 'C:\\isolated-snapshot' }
beforeEach(() => {
  vi.stubEnv('FORGEPILOT_CODEX_API_KEY', 'test-only-executor-key')
  vi.stubEnv('FORGEPILOT_CLAUDE_API_KEY', 'test-only-claude-key')
  vi.stubEnv('FORGEPILOT_AGENT_DOCKER_COMMAND', JSON.stringify([process.execPath, join(process.cwd(), 'tests/fixtures/agent-docker.mjs')]))
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

describe('agent subprocess lifecycle', () => {
  test.each(['codex', 'claude-code'] as const)('requires a dedicated credential for %s', async executor => {
    vi.stubEnv(executor === 'codex' ? 'FORGEPILOT_CODEX_API_KEY' : 'FORGEPILOT_CLAUDE_API_KEY', '')
    await expect(runAgentContainer({ ...request, executor })).rejects.toMatchObject({ data: { code: 'agent.authentication-required' } })
  })
  test('does not inherit control-plane credentials and redacts the executor credential from final output', async () => {
    vi.stubEnv('FORGEPILOT_CREDENTIAL_ENCRYPTION_KEY', 'private-control-plane-key')
    const output = await runAgentContainer({ ...request, prompt: 'MODE:echo-env' })
    expect(output).toBe('{"credential":"[REDACTED]"}')
  })
  test('reports a missing executable without launching a host shell', async () => {
    vi.stubEnv('FORGEPILOT_AGENT_DOCKER_COMMAND', '["forgepilot-nonexistent-docker-executable"]')
    await expect(runAgentContainer(request)).rejects.toMatchObject({ data: { code: 'agent.runner-unavailable' } })
  })
  test('rejects malformed administrator command configuration', async () => {
    vi.stubEnv('FORGEPILOT_AGENT_DOCKER_COMMAND', '{}')
    await expect(runAgentContainer(request)).rejects.toMatchObject({ data: { code: 'agent.runner-unavailable' } })
  })
  test('bounds the raw provider output', async () => {
    await expect(runAgentContainer({ ...request, prompt: 'MODE:oversized' })).rejects.toMatchObject({ data: { code: 'agent.output-invalid' } })
  })
  test('terminates the container and process after the workflow deadline', async () => {
    vi.useFakeTimers()
    const completion = expect(runAgentContainer({ ...request, prompt: 'MODE:hang' })).rejects.toMatchObject({ data: { code: 'agent.timeout' } })
    await vi.advanceTimersByTimeAsync(agentTimeoutMs)
    await completion
  })
})

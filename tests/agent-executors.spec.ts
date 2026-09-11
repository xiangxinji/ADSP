import { describe, expect, test } from 'vitest'
import { findAssetOperation } from '../shared/config/asset-operations'
import { agentExecutorForOperation } from '../shared/types/agent-executors'
import { agentExecutionInput } from '../server/validation/agent-executors'
import { agentContainerArguments } from '../server/integrations/agent-container'
import { parseAgentOutput } from '../server/integrations/agent-output'
import { assertWorkflowOperationOutput } from '../server/services/workflow-value-resolution'

const input = { prompt: '调研代码', writable: false, references: [] }
const codexOutput = (text: string) => JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text } }) + '\n' + JSON.stringify({ type: 'turn.completed' })

describe('agent execution contracts', () => {
  test.each(['repository.agent-codex', 'repository.agent-claude-code'])('declares complete inputs, outputs and errors for %s', id => {
    const operation = findAssetOperation('repository', id)!
    expect(operation).toMatchObject({ execution: { kind: 'command', scope: 'project' }, workflow: { enabled: true } })
    expect(operation.contract.input.map(field => field.name)).toEqual(['prompt', 'writable', 'references', 'upstream'])
    expect(operation.contract.input.find(field => field.name === 'references')?.fields?.map(field => field.name)).toEqual(['assetType', 'assetId'])
    expect(operation.contract.exceptions.map(error => error.code)).toContain('agent.workspace-conflict')
    expect(() => assertWorkflowOperationOutput(operation.contract.output, { text: '完成', executor: agentExecutorForOperation(id), writable: false, durationMs: 2 })).not.toThrow()
  })

  test('accepts explicit fixed permissions and references without including secrets', () => {
    expect(agentExecutionInput({ ...input, references: [{ assetType: 'ai-interface', assetId: 'ai-1' }] })).toEqual({ ...input, references: [{ assetType: 'ai-interface', assetId: 'ai-1' }] })
  })

  test.each([
    { prompt: '' }, { prompt: 'x'.repeat(32_001) }, { writable: 'true' }, { writable: '$root.allowWrite' },
    { references: '$root.assets' }, { references: [{ assetType: 'repository', assetId: '' }] },
    { references: [{ assetType: 'unknown', assetId: 'id' }] },
    { references: [{ assetType: 'repository', assetId: 'id', path: 'C:/secrets' }] },
    { references: Array.from({ length: 21 }, (_, index) => ({ assetType: 'repository', assetId: String(index) })) },
    { references: [{ assetType: 'repository', assetId: 'id' }, { assetType: 'repository', assetId: ' id ' }] },
    { upstream: 'x'.repeat(128_001) }, { apiKey: 'not-an-input' },
  ])('rejects malformed or escalating input %j', override => {
    expect(() => agentExecutionInput({ ...input, ...override })).toThrow(expect.objectContaining({ data: { code: 'agent.invalid-input' } }))
  })
})

describe('CLI output normalization', () => {
  test('requires a completed Codex turn and takes its final agent message', () => {
    expect(parseAgentOutput('codex', codexOutput('依据 src/auth.ts:2'))).toBe('依据 src/auth.ts:2')
    for (const value of ['', '{}', 'not-json', codexOutput(''), '{"type":"turn.failed"}']) expect(() => parseAgentOutput('codex', value)).toThrow()
  })
  test('accepts successful Claude output but rejects tool denials and semantic failures', () => {
    expect(parseAgentOutput('claude-code', JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: '报告' }))).toBe('报告')
    for (const value of [{ is_error: true }, { subtype: 'error_max_turns' }, { subtype: 'success', result: '被拒绝', permission_denials: [{}] }]) {
      expect(() => parseAgentOutput('claude-code', JSON.stringify(value))).toThrow(expect.objectContaining({ data: { code: 'agent.execution-failed' } }))
    }
  })
})

describe('isolated container invocation', () => {
  test.each(['codex', 'claude-code'] as const)('confines %s to a read-only snapshot and never adds bypass flags', executor => {
    const args = agentContainerArguments({ executor, writable: false, prompt: 'never in argv', directory: 'C:\\project,files\\snapshot' }, 'safe-name', 'forgepilot-agent-runner:local')
    expect(args).toContain('--read-only')
    expect(args).toContain('--cap-drop=ALL')
    expect(args[args.indexOf('--mount') + 1]).toContain(',readonly')
    expect(args.join(' ')).not.toMatch(/dangerously|danger-full-access|never in argv|--privileged|docker\.sock/)
    expect(args).toContain('600s')
    if (executor === 'claude-code') expect(args[args.indexOf('--tools') + 1]).toBe('Read,Glob,Grep')
    else expect(args[args.indexOf('--sandbox') + 1]).toBe('read-only')
  })
  test('grants write tools only when explicitly enabled', () => {
    const args = agentContainerArguments({ executor: 'claude-code', writable: true, prompt: '', directory: '/tmp/snapshot' }, 'safe-name', 'image')
    expect(args[args.indexOf('--mount') + 1]).not.toContain(',readonly')
    expect(args[args.indexOf('--tools') + 1]).toBe('Read,Glob,Grep,Edit,Write')
    expect(args).not.toContain('Bash')
  })
})

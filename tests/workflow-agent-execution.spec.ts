import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { WorkflowOperationNode } from '../shared/types/asdp'
import { executeWorkflowGraph } from '../server/services/workflow-graph-execution'
import { executeProjectOperation } from '../server/services/project-operation-execution'
import { runFixture, workflowEdge } from './support/workflow-fixtures'
import { createAssetOperationError } from '../server/utils/asset-operation-error'

vi.mock('../server/services/project-operation-execution', () => ({ executeProjectOperation: vi.fn() }))
vi.mock('../server/repositories/workflow-runs', () => ({ updateWorkflowRun: vi.fn() }))
const agent = (id: string, executor = 'codex'): WorkflowOperationNode => ({
  id, assetType: 'repository', operationId: 'repository.agent-' + executor, assetSource: 'input',
  inputs: { prompt: '调研', writable: false, references: [] }, position: { x: 0, y: 0 },
})
const result = { text: '代码结论', executor: 'codex', writable: false, durationMs: 10 }
beforeEach(() => { vi.mocked(executeProjectOperation).mockReset().mockResolvedValue(result) })

describe('agent nodes in existing workflow graph', () => {
  test('passes root to the first agent and its complete result plus text to the next agent', async () => {
    const first = agent('first')
    const next = agent('next', 'claude-code')
    next.inputs.prompt = '$prev.text'
    const run = runFixture([first, next], [workflowEdge('workflow-trigger', 'first'), workflowEdge('first', 'next')])
    run.root = { requirement: '需求描述' }
    await executeWorkflowGraph(run, new Map())
    expect(run.status).toBe('succeeded')
    expect(vi.mocked(executeProjectOperation).mock.calls[0]?.[3]).toMatchObject({ upstream: JSON.stringify(run.root), references: [], writable: false })
    expect(vi.mocked(executeProjectOperation).mock.calls[1]?.[3]).toMatchObject({ prompt: result.text, upstream: JSON.stringify(result) })
    expect(run.output).toEqual(result)
  })

  test('does not continue the normal edge when an executor fails', async () => {
    vi.mocked(executeProjectOperation).mockRejectedValueOnce(createAssetOperationError(502, 'agent.execution-failed', '失败'))
    const run = runFixture([agent('first'), agent('next')], [workflowEdge('workflow-trigger', 'first'), workflowEdge('first', 'next')])
    await executeWorkflowGraph(run, new Map())
    expect(run.status).toBe('failed')
    expect(run.steps.map(step => step.status)).toEqual(['failed', 'skipped'])
    expect(executeProjectOperation).toHaveBeenCalledTimes(1)
  })

  test('uses stable declared errors for exception branches and supplies the failure as context', async () => {
    vi.mocked(executeProjectOperation).mockRejectedValueOnce(createAssetOperationError(504, 'agent.timeout', '超时'))
    const first = agent('first')
    first.exceptionPorts = [{ id: 'timeout', code: 'agent.timeout' }]
    const run = runFixture([first, agent('recover')], [workflowEdge('workflow-trigger', 'first'), workflowEdge('first', 'recover', 'timeout')])
    await executeWorkflowGraph(run, new Map())
    expect(run.status).toBe('succeeded')
    expect(run.steps[0]?.status).toBe('handled')
    expect(JSON.parse(String(run.steps[1]?.resolvedInputs?.upstream))).toMatchObject({ error: { code: 'agent.timeout' } })
  })
})

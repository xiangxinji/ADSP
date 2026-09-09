import { expect, test, vi } from 'vitest'
import { recoverInterruptedWorkflowRuns } from '../server/services/workflow-runs'
import { listActiveWorkflowRuns, updateWorkflowRun } from '../server/repositories/workflow-runs'
import { asyncNode, operationNode, runFixture, workflowEdge as edge } from './support/workflow-fixtures'

vi.mock('../server/repositories/workflow-runs', () => ({ listActiveWorkflowRuns: vi.fn(), updateWorkflowRun: vi.fn() }))

test('recovers invocation records as well as node summaries without overwriting completed results', () => {
  const run = runFixture([asyncNode(), operationNode('child')], [edge('workflow-trigger', 'parallel'), edge('parallel', 'child', 'item')])
  const control = run.steps[0]!
  const child = run.steps[1]!
  control.status = 'running'
  child.status = 'running'
  child.executions = ['succeeded', 'running', 'pending'].map((status, index) => ({
    ...child, status: status as 'succeeded' | 'running' | 'pending', iterationPath: [{ nodeId: 'parallel', index }],
    ...(index === 0 ? { output: { repositoryId: 'child', branch: 'done', source: 'main' }, finishedAt: '2026-09-09T00:00:00.000Z' } : {}),
  }))
  const completed = structuredClone(child.executions[0])
  vi.mocked(listActiveWorkflowRuns).mockReturnValue([run])
  recoverInterruptedWorkflowRuns()
  expect(run.status).toBe('failed')
  expect(child.executions.map(execution => execution.status)).toEqual(['succeeded', 'failed', 'skipped'])
  expect(child.executions[0]).toEqual(completed)
  expect(child.executions[1]?.error?.code).toBe('workflow.interrupted')
  expect(child.executions.every(execution => execution.finishedAt)).toBe(true)
  expect(updateWorkflowRun).toHaveBeenCalledWith(run)
})

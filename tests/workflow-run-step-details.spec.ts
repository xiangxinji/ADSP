import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, describe, expect, test } from 'vitest'
import { useWorkflowRunStepDetails } from '../app/composables/useWorkflowRunStepDetails'
import { formatWorkflowRunTime, workflowRunNodeLabel } from '../app/utils/workflow-run-display'
import { asyncNode, operationNode, runFixture, subworkflowNode } from './support/workflow-fixtures'
import type { WorkflowRun, WorkflowRunStep } from '../shared/types/workflow-runs'

const scopes: EffectScope[] = []
const setup = (initial = runFixture([operationNode('first'), operationNode('second')], [])) => {
  const run = ref(initial)
  const stepIndex = ref(0)
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => useWorkflowRunStepDetails(() => run.value, () => run.value.steps[stepIndex.value]!))!
  return { ...state, run, stepIndex }
}
const withIterations = (run: WorkflowRun) => {
  const step = run.steps[0]!
  step.executions = [0, 1].map(index => ({
    ...step, status: 'succeeded', output: { index }, resolvedInputs: { branch: `feature/${index}` },
    iterationPath: [{ nodeId: 'loop', index }],
  }))
  return run
}

afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

describe('workflow run step details', () => {
  test('defaults to the node summary and exposes operation configuration', () => {
    const state = setup()
    expect(state.selectedIteration.value).toBe(-1)
    expect(state.selectedStep.value).toEqual(state.run.value.steps[0])
    expect(state.selectedInputs.value).toEqual({ repositoryId: 'first', branch: 'feature/first', source: 'main' })
    expect(state.selectedNode.value?.id).toBe('first')
    expect(state.controlOutput.value).toBeNull()
  })

  test('selects per-iteration inputs, output, errors, and nested runs independently', () => {
    const run = withIterations(runFixture([subworkflowNode()], []))
    const execution = run.steps[0]!.executions![1]!
    execution.status = 'failed'
    execution.error = { code: 'CHILD_FAILED', message: '子工作流失败' }
    execution.childRun = runFixture([operationNode('child')], [])
    const state = setup(run)
    state.selectedIteration.value = 1
    expect(state.selectedStep.value.output).toEqual({ index: 1 })
    expect(state.selectedStep.value.resolvedInputs).toEqual({ branch: 'feature/1' })
    expect(state.selectedStep.value.error).toEqual(execution.error)
    expect(state.selectedStep.value.childRun).toEqual(execution.childRun)
    expect(state.selectedInputs.value).toEqual({ workflowId: 'child-workflow', root: '上游输出', output: '子工作流最终输出' })
    state.selectedIteration.value = -1
    expect(state.selectedStep.value.error).toBeNull()
    expect(state.selectedStep.value.childRun).toBeUndefined()
  })

  test('preserves the existing summary reset when polling replaces the snapshot', async () => {
    const initial = withIterations(runFixture([operationNode('first')], []))
    const state = setup(initial)
    state.selectedIteration.value = 1
    const refreshed = structuredClone(initial)
    refreshed.steps[0]!.executions![1]!.output = { updated: true }
    state.run.value = refreshed
    await nextTick()
    expect(state.selectedIteration.value).toBe(-1)
    expect(state.selectedStep.value).toEqual(refreshed.steps[0])
    state.selectedIteration.value = 1
    expect(state.selectedStep.value.output).toEqual({ updated: true })
  })

  test('resets iteration selection when the run or selected node changes', async () => {
    const state = setup(withIterations(runFixture([operationNode('first'), operationNode('second')], [])))
    state.selectedIteration.value = 1
    state.stepIndex.value = 1
    await nextTick()
    expect(state.selectedIteration.value).toBe(-1)
    expect(state.selectedStep.value.nodeId).toBe('second')
    state.selectedIteration.value = 0
    state.run.value.id = 'run-2'
    await nextTick()
    expect(state.selectedIteration.value).toBe(-1)
  })

  test('falls back to summary data if the selected iteration is unavailable', () => {
    const state = setup()
    state.selectedIteration.value = 10
    expect(state.selectedStep.value).toEqual(state.run.value.steps[0])
  })

  test('keeps modern array iteration and legacy branch details distinct', () => {
    const run = runFixture([asyncNode()], [])
    const output = { branches: [], selectedPort: 'complete' as const }
    run.steps[0]!.output = output
    const state = setup(run)
    expect(state.legacyControl.value).toBe(false)
    expect(state.selectedInputs.value).toEqual({ input: '上一个节点的输出数组', childPort: 'item' })
    expect(state.controlOutput.value).toEqual(output)
    state.run.value.workflow.nodes[0] = { ...asyncNode(), branches: [{ id: 'legacy', label: '历史分支' }] }
    expect(state.legacyControl.value).toBe(true)
    expect(state.selectedInputs.value).toEqual({ branches: [{ id: 'legacy', label: '历史分支' }] })
    expect(state.branchLabel('legacy')).toBe('历史分支')
    expect(state.branchLabel('unknown')).toBe('unknown')
  })

  test('does not interpret arbitrary operation output as a control result', () => {
    const state = setup()
    state.run.value.steps[0]!.output = { branches: [], selectedPort: 'complete' }
    expect(state.controlOutput.value).toBeNull()
    state.run.value.workflow.nodes[0] = { ...asyncNode(), id: 'first' }
    for (const output of [null, [], 'value', { branches: [] }]) {
      state.run.value.steps[0]!.output = output
      expect(state.controlOutput.value).toBeNull()
    }
  })

  test.each<WorkflowRunStep['status']>(['pending', 'running', 'succeeded', 'failed', 'handled', 'skipped'])(
    'preserves the incomplete duration label for %s steps', (status) => {
      const state = setup()
      state.run.value.steps[0]!.status = status
      expect(state.duration.value).toBe(status === 'running' ? '执行中' : '—')
    },
  )

  test('formats completed durations and tolerates a missing snapshot node', () => {
    const state = setup()
    Object.assign(state.run.value.steps[0]!, { startedAt: '2026-09-09T00:00:00Z', finishedAt: '2026-09-09T00:00:01.250Z' })
    expect(state.duration.value).toBe('1.25 秒')
    state.run.value.workflow.nodes = []
    expect(state.selectedNode.value).toBeUndefined()
    expect(state.selectedInputs.value).toBeUndefined()
    expect(state.controlOutput.value).toBeNull()
  })

  test('shares timestamp and node-label formatting without losing fallback identifiers', () => {
    const run = runFixture([subworkflowNode()], [])
    expect(workflowRunNodeLabel(run, 'call')).toBe('执行子工作流')
    expect(workflowRunNodeLabel(run, 'unknown')).toBe('unknown')
    expect(workflowRunNodeLabel(null, 'unknown')).toBe('unknown')
    expect(formatWorkflowRunTime(null)).toBe('—')
    const timestamp = '2026-09-09T00:00:00Z'
    expect(formatWorkflowRunTime(timestamp)).toBe(new Date(timestamp).toLocaleString('zh-CN', { hour12: false }))
  })
})

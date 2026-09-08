import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useWorkflowRuns } from '../app/composables/useWorkflowRuns'
import type { WorkflowRun } from '../shared/types/workflow-runs'

const result = (status: WorkflowRun['status'] = 'running'): WorkflowRun => ({
  id: 'run-1', workflowId: 'workflow-1', root: {}, status, steps: [],
  startedAt: '2026-09-08T00:00:00.000Z', finishedAt: null,
  workflow: { id: 'workflow-1', projectId: 'project-1', name: 'Test', note: '', trigger: null, nodes: [], edges: [], createdAt: '', updatedAt: '' },
})
let mounted: () => Promise<void>
let unmounted: () => void
const fetchMock = vi.fn()

describe('workflow run polling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('$fetch', fetchMock)
    vi.stubGlobal('onMounted', (callback: typeof mounted) => { mounted = callback })
    vi.stubGlobal('onBeforeUnmount', (callback: typeof unmounted) => { unmounted = callback })
  })
  afterEach(() => {
    unmounted?.()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test('loads persisted progress and polls until a terminal result is visible', async () => {
    fetchMock.mockResolvedValueOnce([result()]).mockResolvedValueOnce([result('succeeded')])
    const state = useWorkflowRuns('workflow-1')
    await mounted()
    expect(state.running.value).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.selectedRun.value?.status).toBe('succeeded')
    expect(state.running.value).toBe(false)
    unmounted()
    await vi.advanceTimersByTimeAsync(3000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('does not launch duplicates and keeps history on polling failures', async () => {
    fetchMock.mockResolvedValueOnce([result()]).mockRejectedValueOnce(new Error('offline'))
    const state = useWorkflowRuns('workflow-1')
    await mounted()
    expect(await state.startRun()).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.loadError.value).toContain('上次结果')
    expect(state.selectedRun.value?.id).toBe('run-1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('starts once, selects the new run and protects it from an older GET response', async () => {
    fetchMock.mockResolvedValueOnce([])
    const state = useWorkflowRuns('workflow-1')
    await mounted()
    let resolveOlder: (runs: WorkflowRun[]) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveOlder = resolve }))
    const older = state.refreshRuns()
    fetchMock.mockResolvedValueOnce(result())
    expect(await state.startRun()).toBe(true)
    expect(await state.startRun()).toBe(false)
    resolveOlder([])
    await older
    expect(state.selectedRunId.value).toBe('run-1')
    expect(state.selectedRun.value?.status).toBe('running')
    expect(fetchMock).toHaveBeenCalledWith('/api/workflows/workflow-1/runs', { method: 'POST', body: { root: {} } })
  })

  test('reports start failures without inventing an execution record', async () => {
    fetchMock.mockResolvedValueOnce([])
    const state = useWorkflowRuns('workflow-1')
    await mounted()
    fetchMock.mockRejectedValueOnce({ data: { statusMessage: '工作流配置无效' } }).mockResolvedValueOnce([])
    expect(await state.startRun()).toBe(false)
    expect(state.startError.value).toBe('工作流配置无效')
    expect(state.runs.value).toEqual([])
    expect(state.starting.value).toBe(false)
  })
})

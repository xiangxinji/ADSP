import type { WorkflowRun } from '#shared/types/workflow-runs'

export const useWorkflowRuns = (workflowId: string) => {
  const runs = ref<WorkflowRun[]>([])
  const selectedRunId = ref('')
  const starting = ref(false)
  const loading = ref(true)
  const loadError = ref('')
  const startError = ref('')
  const selectedRun = computed(() => runs.value.find(run => run.id === selectedRunId.value) || runs.value[0] || null)
  const running = computed(() => starting.value || runs.value.some(run => run.status === 'running'))
  const endpoint = `/api/workflows/${workflowId}/runs`
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let refreshing: Promise<void> | null = null
  let revision = 0

  const refreshRuns = () => {
    if (refreshing) return refreshing
    const requestRevision = revision
    refreshing = (async () => {
      try {
        const result = await $fetch<WorkflowRun[]>(endpoint)
        if (!disposed && requestRevision === revision) runs.value = result
        loadError.value = ''
      } catch {
        loadError.value = '运行状态更新失败，显示的是上次结果，正在重试。'
      } finally {
        loading.value = false
        refreshing = null
      }
    })()
    return refreshing
  }

  const poll = async () => {
    await refreshRuns()
    if (!disposed) timer = setTimeout(poll, 1000)
  }

  const startRun = async () => {
    if (running.value || loading.value || loadError.value) return false
    starting.value = true
    startError.value = ''
    try {
      const run = await $fetch<WorkflowRun>(endpoint, { method: 'POST' })
      revision += 1
      runs.value = [run, ...runs.value.filter(item => item.id !== run.id)]
      selectedRunId.value = run.id
      return true
    } catch (error: any) {
      startError.value = error?.data?.statusMessage || error?.message || '启动工作流失败'
      await refreshRuns()
      return false
    } finally {
      starting.value = false
    }
  }

  onMounted(poll)
  onBeforeUnmount(() => {
    disposed = true
    if (timer) clearTimeout(timer)
  })

  return { runs, selectedRunId, selectedRun, running, starting, loading, loadError, startError, startRun, refreshRuns }
}

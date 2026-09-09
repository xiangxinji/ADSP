import { recoverInterruptedWorkflowRuns } from '../services/workflow-runs'
import { processWorkflowTriggerQueue, recoverWorkflowTriggerQueue } from '../services/workflow-trigger-queue'

export default defineNitroPlugin((nitroApp) => {
  recoverInterruptedWorkflowRuns()
  recoverWorkflowTriggerQueue()
  void processWorkflowTriggerQueue()
  const interval = setInterval(() => { void processWorkflowTriggerQueue() }, 1_000)
  interval.unref()
  nitroApp.hooks.hook('close', () => clearInterval(interval))
})

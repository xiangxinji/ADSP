import { findWorkflowRunForTriggerEvent } from '../repositories/workflow-runs'
import {
  markDomainEventCompleted,
  markDomainEventFailed,
  markDomainEventProcessing,
  nextPendingDomainEvent,
  recoverProcessingDomainEvents,
} from '../repositories/domain-events'
import { listProjectWorkflows } from './workflow-definitions'
import { startRequirementCreatedWorkflowRun } from './workflow-run-orchestration'

let activeDrain: Promise<void> | null = null

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

const processNextEvent = async () => {
  const event = nextPendingDomainEvent()
  if (!event) return false
  markDomainEventProcessing(event.id)
  try {
    const completions: Promise<void>[] = []
    const errors: unknown[] = []
    const workflows = listProjectWorkflows(event.projectId)
      .filter(workflow => workflow.trigger?.kind === event.type && workflow.nodes.length)
    for (const workflow of workflows) {
      if (findWorkflowRunForTriggerEvent(workflow.id, event.id)) continue
      try {
        completions.push(startRequirementCreatedWorkflowRun(workflow, event.payload, event.id).completion)
      } catch (error) {
        errors.push(error)
      }
    }
    const results = await Promise.allSettled(completions)
    errors.push(...results.filter(result => result.status === 'rejected').map(result => result.reason))
    if (errors.length) {
      throw new Error(`One or more requirement-created workflows could not be dispatched: ${errors.map(errorMessage).join('; ')}`)
    }
    markDomainEventCompleted(event.id)
  } catch (error) {
    markDomainEventFailed(event.id, errorMessage(error))
  }
  return true
}

const drainWorkflowTriggerQueue = async () => {
  while (await processNextEvent()) {
    // Keep draining events in creation order so one workflow never overlaps its next trigger.
  }
}

export const processWorkflowTriggerQueue = () => {
  if (!activeDrain) activeDrain = drainWorkflowTriggerQueue().finally(() => { activeDrain = null })
  return activeDrain
}

export const recoverWorkflowTriggerQueue = () => recoverProcessingDomainEvents()

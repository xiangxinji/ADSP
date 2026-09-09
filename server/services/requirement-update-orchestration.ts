import type { UpdateRequirementInput } from '../../shared/types/asdp'
import { updateRequirement } from './requirements'
import { processWorkflowTriggerQueue } from './workflow-trigger-queue'

export const updateRequirementAndQueueWorkflows = (id: string, input: UpdateRequirementInput) => {
  const requirement = updateRequirement(id, input)
  const completion = processWorkflowTriggerQueue()
  return { requirement, completion }
}

import type { CreateRequirementInput } from '../../shared/types/asdp'
import { createRequirement } from './requirements'
import { processWorkflowTriggerQueue } from './workflow-trigger-queue'

export const createRequirementAndQueueWorkflows = (projectId: string, input: CreateRequirementInput) => {
  const requirement = createRequirement(projectId, input)
  const completion = processWorkflowTriggerQueue()
  return { requirement, completion }
}

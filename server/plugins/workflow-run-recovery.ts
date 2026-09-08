import { recoverInterruptedWorkflowRuns } from '../services/workflow-runs'

export default defineNitroPlugin(() => recoverInterruptedWorkflowRuns())

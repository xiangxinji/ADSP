import { updateWorkflow } from '../../services/workflow-definitions'
import { routeParameter } from '../../utils/http-input'
import { updateWorkflowPayload } from '../../validation/workflow-definitions'

export default defineEventHandler(async event => updateWorkflow(
  routeParameter(event),
  updateWorkflowPayload(await readBody(event)),
))

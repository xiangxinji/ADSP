import { createWorkflow } from '../../../../services/workflow-definitions'
import { routeParameter } from '../../../../utils/http-input'
import { createWorkflowPayload } from '../../../../validation/workflow-definitions'

export default defineEventHandler(async (event) => {
  const workflow = createWorkflow(routeParameter(event), createWorkflowPayload(await readBody(event)))
  setResponseStatus(event, 201)
  return workflow
})

import { startManualWorkflowRun } from '../../../../services/workflow-run-orchestration'
import { routeParameter } from '../../../../utils/http-input'
import { workflowRunPayload } from '../../../../validation/workflow-runs'

export default defineEventHandler(async (event) => {
  const root = workflowRunPayload(await readBody(event))
  const { run, completion } = startManualWorkflowRun(routeParameter(event), root)
  event.waitUntil(completion)
  setResponseStatus(event, 202)
  return run
})

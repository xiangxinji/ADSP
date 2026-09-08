import { getWorkflowRuns } from '../../../../services/workflow-run-orchestration'
import { routeParameter } from '../../../../utils/http-input'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return getWorkflowRuns(routeParameter(event))
})

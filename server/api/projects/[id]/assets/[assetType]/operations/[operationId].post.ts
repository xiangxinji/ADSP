import { executeProjectOperation } from '../../../../../../services/project-operation-execution'
import { agentExecutorForOperation } from '../../../../../../../shared/types/agent-executors'
import { agentExecutionInput } from '../../../../../../validation/agent-executors'
import { routeParameter } from '../../../../../../utils/http-input'
import { projectAssetOperationInput, projectAssetOperationType } from '../../../../../../validation/project-asset-operations'

export default defineEventHandler(async (event) => {
  const assetType = projectAssetOperationType(routeParameter(event, 'assetType'))
  const input = await readBody(event)
  const operationId = routeParameter(event, 'operationId')
  if (assetType === 'repository' && agentExecutorForOperation(operationId)) agentExecutionInput(input)
  else projectAssetOperationInput(input)
  return executeProjectOperation(routeParameter(event), assetType, operationId, input)
})

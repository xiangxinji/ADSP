import type { AssetType } from '../../shared/types/asset-operations'
import { agentExecutorForOperation } from '../../shared/types/agent-executors'
import { executeAgentOperation } from './agent-execution-orchestration'
import { executeProjectAssetOperation } from './project-asset-operations'

export const executeProjectOperation = (projectId: string, assetType: AssetType, operationId: string, input?: unknown) => {
  const executor = assetType === 'repository' ? agentExecutorForOperation(operationId) : null
  return executor ? executeAgentOperation(projectId, executor, input)
    : executeProjectAssetOperation(projectId, assetType, operationId, input)
}

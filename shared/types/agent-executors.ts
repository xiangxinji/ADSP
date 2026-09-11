import type { AssetType } from './asset-operations'

export type AgentExecutor = 'codex' | 'claude-code'
export type AgentAssetReference = { assetType: AssetType, assetId: string }
export type AgentExecutionInput = {
  prompt: string
  writable: boolean
  references: AgentAssetReference[]
  upstream?: string
}
export type AgentExecutionResult = {
  text: string
  executor: AgentExecutor
  writable: boolean
  durationMs: number
}

export const agentExecutorForOperation = (operationId: string): AgentExecutor | null => {
  if (operationId === 'repository.agent-codex') return 'codex'
  if (operationId === 'repository.agent-claude-code') return 'claude-code'
  return null
}

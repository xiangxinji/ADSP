import type { AgentExecutor } from '../../shared/types/agent-executors'
import { createAssetOperationError } from '../utils/asset-operation-error'

export const parseAgentOutput = (executor: AgentExecutor, output: string) => {
  const invalid = () => createAssetOperationError(502, 'agent.output-invalid', '执行器未返回完整、有效的最终结果。')
  try {
    if (executor === 'claude-code') {
      const result = JSON.parse(output)
      if (result.is_error !== false || result.subtype !== 'success' || result.permission_denials?.length) {
        throw createAssetOperationError(502, 'agent.execution-failed', 'Claude Code 执行失败或请求了未授权的工具。')
      }
      if (typeof result.result !== 'string' || !result.result.trim()) throw invalid()
      return result.result
    }
    const events = output.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line))
    if (events.some(event => event.type === 'turn.failed' || event.type === 'error')) {
      throw createAssetOperationError(502, 'agent.execution-failed', 'Codex 执行失败，请检查模型服务与执行器配置。')
    }
    const final = events.filter(event => event.type === 'item.completed' && event.item?.type === 'agent_message').at(-1)?.item.text
    if (!events.some(event => event.type === 'turn.completed') || typeof final !== 'string' || !final.trim()) throw invalid()
    return final
  } catch (error) {
    if (error && typeof error === 'object' && 'data' in error) throw error
    throw invalid()
  }
}

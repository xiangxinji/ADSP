import { assetTypes } from '../../shared/types/asset-operations'
import type { AgentExecutionInput } from '../../shared/types/agent-executors'
import { createAssetOperationError } from '../utils/asset-operation-error'

const invalid = () => createAssetOperationError(400, 'agent.invalid-input', '请检查提示词、读写权限、引用资产与上游数据。')

export const agentExecutionInput = (value: unknown): AgentExecutionInput => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  const input = value as Record<string, unknown>
  if (Object.keys(input).some(key => !['prompt', 'writable', 'references', 'upstream'].includes(key))
    || typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 32_000
    || typeof input.writable !== 'boolean' || !Array.isArray(input.references) || input.references.length > 20
    || (input.upstream !== undefined && (typeof input.upstream !== 'string' || input.upstream.length > 128_000))) throw invalid()
  const seen = new Set<string>()
  const references = input.references.map(reference => {
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)
      || Object.keys(reference).some(key => !['assetType', 'assetId'].includes(key))
      || !assetTypes.includes(reference.assetType) || typeof reference.assetId !== 'string'
      || !reference.assetId.trim() || reference.assetId.length > 100) throw invalid()
    const key = `${reference.assetType}:${reference.assetId.trim()}`
    if (seen.has(key)) throw invalid()
    seen.add(key)
    return { assetType: reference.assetType, assetId: reference.assetId.trim() }
  })
  return { prompt: input.prompt.trim(), writable: input.writable, references, ...(input.upstream === undefined ? {} : { upstream: input.upstream as string }) }
}

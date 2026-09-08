import { createError } from 'h3'
import type { WorkflowValue, WorkflowValueObject } from '../../shared/types/asdp'
import { bodyObject } from '../utils/http-input'

const rootValue = (value: unknown): WorkflowValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(rootValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rootValue(child)]))
  }
  throw createError({ statusCode: 400, statusMessage: '根节点数据必须是有效的 JSON 值' })
}

export const workflowRunPayload = (value: unknown) => {
  if (value === undefined || value === null || value === '') return {} as WorkflowValueObject
  const body = bodyObject(value)
  const unknownField = Object.keys(body).find(key => key !== 'root')
  if (unknownField) {
    throw createError({ statusCode: 400, statusMessage: '运行只接受根节点数据，不支持覆盖节点或项目' })
  }
  if (body.root === undefined) return {}
  const root = rootValue(body.root)
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    throw createError({ statusCode: 400, statusMessage: 'root 必须是 JSON 对象' })
  }
  return root as WorkflowValueObject
}

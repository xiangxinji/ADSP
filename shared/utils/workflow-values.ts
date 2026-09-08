import type { WorkflowValue } from '../types/asdp'

export type WorkflowValueReference = {
  source: 'root' | 'prev'
  path: string[]
}
const referencePattern = /^\$(root|prev)(?:\.(?:[A-Za-z_][A-Za-z0-9_-]*|0|[1-9]\d*))+$/

export const looksLikeWorkflowValueReference = (value: unknown) =>
  typeof value === 'string' && /^\$(?:root|prev)(?:\.|$)/.test(value.trim())

export const parseWorkflowValueReference = (value: unknown): WorkflowValueReference | null => {
  if (typeof value !== 'string') return null
  const reference = value.trim()
  if (!referencePattern.test(reference)) return null
  const [source, ...path] = reference.slice(1).split('.')
  return { source: source as WorkflowValueReference['source'], path }
}

export const workflowValueReferenceError = (value: unknown) => {
  if (!looksLikeWorkflowValueReference(value) || parseWorkflowValueReference(value)) return ''
  return '取值表达式格式无效，请使用 $root.xxx 或 $prev.xxx；嵌套数组使用数字下标，例如 $prev.items.0.id。'
}

export const workflowValueAtPath = (value: WorkflowValue, path: string[]) => {
  let current: WorkflowValue = value
  for (const segment of path) {
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(segment) || Number(segment) >= current.length) return { found: false as const }
      current = current[Number(segment)]!
      continue
    }
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segment)) {
      return { found: false as const }
    }
    current = current[segment]!
  }
  return { found: true as const, value: current }
}

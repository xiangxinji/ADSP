import { createError } from 'h3'
import type { AssetOperationArrayType, AssetOperationField } from '../../shared/types/asset-operations'
import type {
  WorkflowOperationInputValue,
  WorkflowOperationResolvedInputs,
  WorkflowValue,
  WorkflowValueObject,
} from '../../shared/types/asdp'
import {
  looksLikeWorkflowValueReference,
  parseWorkflowValueReference,
  workflowValueAtPath,
  workflowValueReferenceError,
} from '../../shared/utils/workflow-values'

const inputReferenceError = (code: string, statusMessage: string) => createError({
  statusCode: 422,
  statusMessage,
  data: { code },
})

const matchesFieldType = (field: AssetOperationField, value: unknown): boolean => {
  if (value === null) return Boolean(field.nullable)
  if (field.type === 'object[]') return Array.isArray(value) && value.every(item => matchesObjectFields(field.fields || [], item))
  if (field.type === 'object') return matchesObjectFields(field.fields || [], value)
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value)
  return field.type === 'boolean' ? typeof value === 'boolean' : typeof value === 'string'
}

const matchesObjectFields = (fields: readonly AssetOperationField[], value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return fields.every(field => Object.hasOwn(record, field.name) && matchesFieldType(field, record[field.name]))
}

export const validateWorkflowInputReferences = (
  inputs: Record<string, WorkflowOperationInputValue>,
) => {
  for (const value of Object.values(inputs)) {
    const message = workflowValueReferenceError(value)
    if (message) throw inputReferenceError('workflow.input-reference-invalid', message)
  }
}
export const workflowInputHasReferences = (inputs: Record<string, WorkflowOperationInputValue>) =>
  Object.values(inputs).some(value => Boolean(parseWorkflowValueReference(value)))

export const resolveWorkflowOperationInputs = (
  inputs: Record<string, WorkflowOperationInputValue>,
  fields: readonly AssetOperationField[],
  root: WorkflowValueObject,
  previous: WorkflowValue | undefined,
): WorkflowOperationResolvedInputs => Object.fromEntries(fields.flatMap(field => {
  const configured = inputs[field.name]
  if (configured === undefined) return []
  const reference = parseWorkflowValueReference(configured)
  if (!reference) {
    if (looksLikeWorkflowValueReference(configured)) {
      throw inputReferenceError('workflow.input-reference-invalid', `参数 ${field.name} 的取值表达式格式无效`)
    }
    return [[field.name, configured]]
  }

  const source = reference.source === 'root' ? root : previous
  if (source === undefined) {
    throw inputReferenceError('workflow.previous-output-unavailable', `参数 ${field.name} 无法读取上一份输出`)
  }
  const resolved = workflowValueAtPath(source, reference.path)
  if (!resolved.found) {
    throw inputReferenceError('workflow.input-reference-not-found', `参数 ${field.name} 的取值路径 ${configured} 不存在`)
  }
  if (!matchesFieldType(field, resolved.value)) {
    throw inputReferenceError('workflow.input-type-mismatch', `参数 ${field.name} 的取值类型与 ${field.type} 不匹配`)
  }
  return [[field.name, resolved.value]]
}))

export const assertWorkflowOperationOutput = (
  fields: readonly AssetOperationField[],
  output: unknown,
  outputType?: AssetOperationArrayType,
): asserts output is WorkflowValueObject | WorkflowValueObject[] => {
  if (outputType) {
    if (!Array.isArray(output) || !output.every(item => matchesObjectFields(fields, item))) {
      throw new Error(`Workflow operation output violates its ${outputType} contract`)
    }
    return
  }
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    throw new Error('Workflow operation output must be an object')
  }
  const record = output as Record<string, unknown>
  for (const field of fields) {
    if (!(field.name in record) || !matchesFieldType(field, record[field.name] as WorkflowValue)) {
      throw new Error(`Workflow operation output violates its contract at ${field.name}`)
    }
  }
}

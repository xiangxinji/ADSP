import { describe, expect, test } from 'vitest'
import {
  assertWorkflowOperationOutput,
  resolveWorkflowOperationInputs,
  validateWorkflowInputReferences,
} from '../server/services/workflow-value-resolution'
import { parseWorkflowValueReference, workflowValueAtPath } from '../shared/utils/workflow-values'

const fields = [
  { name: 'branch', type: 'string', required: true, description: 'Branch' },
  { name: 'enabled', type: 'boolean', required: true, description: 'Enabled' },
] as const

describe('workflow value references', () => {
  test('parses root and previous references with nested object and array paths', () => {
    expect(parseWorkflowValueReference('$root.release.branch')).toEqual({ source: 'root', path: ['release', 'branch'] })
    expect(parseWorkflowValueReference('$prev.items.0.enabled')).toEqual({ source: 'prev', path: ['items', '0', 'enabled'] })
    expect(workflowValueAtPath({ items: [{ enabled: true }] }, ['items', '0', 'enabled']))
      .toEqual({ found: true, value: true })
  })

  test.each(['$root', '$prev.', '$root..branch', '$prev.items[0].id'])('rejects malformed reference %s', value => {
    expect(() => validateWorkflowInputReferences({ value })).toThrowError(/取值表达式格式无效/)
  })

  test('resolves exact values without converting their declared types', () => {
    const resolved = resolveWorkflowOperationInputs(
      { branch: '$root.release.branch', enabled: '$prev.items.0.enabled' },
      fields,
      { release: { branch: 'feature/value-flow' } },
      { items: [{ enabled: true }] },
    )
    expect(resolved).toEqual({ branch: 'feature/value-flow', enabled: true })
  })

  test('uses stable errors for missing paths and type mismatches', () => {
    expect(() => resolveWorkflowOperationInputs({ branch: '$root.missing', enabled: true }, fields, {}, undefined))
      .toThrowError(expect.objectContaining({ data: { code: 'workflow.input-reference-not-found' } }))
    expect(() => resolveWorkflowOperationInputs({ branch: '$root.enabled', enabled: true }, fields, { enabled: false }, undefined))
      .toThrowError(expect.objectContaining({ data: { code: 'workflow.input-type-mismatch' } }))
  })

  test('checks operation results against the declared output shape', () => {
    expect(() => assertWorkflowOperationOutput(fields, { branch: 'feature/output', enabled: true })).not.toThrow()
    expect(() => assertWorkflowOperationOutput(fields, { branch: 'feature/output', enabled: 'true' })).toThrow(/enabled/)
  })
})

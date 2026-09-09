import { describe, expect, test } from 'vitest'
import { workflowPreviousValueFields } from '../app/utils/workflow-value-fields'
import { asyncNode, listNode, operationNode, workflowEdge as edge, workflowFixture } from './support/workflow-fixtures'

const operation = (id: string) => ({
  ...operationNode(id), exceptionPorts: [{ id: 'exists', code: 'repository.branch-already-exists' }],
})

describe('workflow previous-value field suggestions', () => {
  test('retains normal output and array-item suggestions', () => {
    const workflow = workflowFixture([listNode(), asyncNode(), operation('child'), operation('next')], [
      edge('workflow-trigger', 'items'), edge('items', 'parallel'), edge('parallel', 'child', 'item'), edge('child', 'next'),
    ])
    expect(workflowPreviousValueFields(workflow, 'parallel').map(field => field.name)).toContain('0.id')
    expect(workflowPreviousValueFields(workflow, 'child').map(field => field.name)).toContain('id')
    expect(workflowPreviousValueFields(workflow, 'next').map(field => field.name)).toEqual(['repositoryId', 'branch', 'source'])
  })

  test.each(['sync', 'async'] as const)('suggests original item fields and wrapped error fields on %s exception paths', kind => {
    const workflow = workflowFixture([listNode(), { ...asyncNode(), kind }, operation('failed'), operation('handler')], [
      edge('workflow-trigger', 'items'), edge('items', 'parallel'), edge('parallel', 'failed', 'item'), edge('failed', 'handler', 'exists'),
    ])
    const names = workflowPreviousValueFields(workflow, 'handler').map(field => field.name)
    expect(names).toEqual(expect.arrayContaining(['id', 'name', 'localOperation.error', 'error.code', 'error.message']))
    expect(names).not.toEqual(expect.arrayContaining(['repositoryId', 'branch', 'source']))
    expect(names).not.toContain('code')
    expect(names).not.toContain('message')
  })

  test('retains array paths through nested exceptions without duplicating error fields', () => {
    const workflow = workflowFixture([listNode(), operation('failed'), operation('handler'), operation('fallback')], [
      edge('workflow-trigger', 'items'), edge('items', 'failed'), edge('failed', 'handler', 'exists'), edge('handler', 'fallback', 'exists'),
    ])
    const names = workflowPreviousValueFields(workflow, 'fallback').map(field => field.name)
    expect(names).toContain('0.id')
    expect(names.filter(name => name === 'error.code')).toHaveLength(1)
    expect(names.filter(name => name === 'error.message')).toHaveLength(1)
    expect(names).not.toContain('repositoryId')
  })

  test('does not invent root fields or successful output for a failed operation', () => {
    const workflow = workflowFixture([operation('failed'), operation('handler')], [
      edge('workflow-trigger', 'failed'), edge('failed', 'handler', 'exists'),
    ])
    expect(workflowPreviousValueFields(workflow, 'handler').map(field => field.name)).toEqual(['error.code', 'error.message'])
    expect(workflowPreviousValueFields(workflow, 'failed')).toEqual([])
  })

  test('handles disconnected nodes and invalid draft cycles without recursive overflow', () => {
    const workflow = workflowFixture([operation('first'), operation('second')], [
      edge('first', 'second', 'exists'), edge('second', 'first', 'exists'),
    ])
    expect(workflowPreviousValueFields(workflow, 'first').map(field => field.name)).toEqual(['error.code', 'error.message'])
    expect(workflowPreviousValueFields(workflow, 'missing')).toEqual([])
    workflow.edges[0]!.sourceHandle = 'unknown'
    expect(workflowPreviousValueFields(workflow, 'second')).toEqual([])
  })
})

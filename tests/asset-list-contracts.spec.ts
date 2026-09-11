import { computed, ref } from 'vue'
import { describe, expect, test } from 'vitest'
import { agentExecutorForOperation } from '../shared/types/agent-executors'
import { assetOperationConfig, findAssetOperation, isProjectAssetOperation } from '../shared/config/asset-operations'
import type { AssetOperationField } from '../shared/types/asset-operations'
import type { WorkflowDefinition } from '../shared/types/asdp'
import { assetOperationOutputFields } from '../shared/utils/asset-operation-contract'
import { assertWorkflowOperationOutput, resolveWorkflowOperationInputs } from '../server/services/workflow-value-resolution'
import { useWorkflowOperationNodes } from '../app/composables/useWorkflowOperationNodes'
import { parseWorkflowNodeDragData, serializeWorkflowNodeDragData } from '../app/utils/workflow-node-drag'
import { workflowOperationGroups } from '../app/utils/workflow-operation-library'
import { workflowFixture } from './support/workflow-fixtures'

const assertFieldsDocumented = (fields: readonly AssetOperationField[]) => {
  expect(new Set(fields.map(field => field.name)).size).toBe(fields.length)
  for (const field of fields) {
    expect(field.name).toBeTruthy()
    expect(field.type).toBeTruthy()
    expect(field.required).toBe(true)
    expect(field.description).toBeTruthy()
    if (field.type === 'object' || field.type === 'object[]') {
      expect(field.fields?.length).toBeGreaterThan(0)
      assertFieldsDocumented(field.fields!)
    }
  }
}

describe('asset collection contracts and grouped node library', () => {
  test.each([
    ['repository', 'RepositoryAsset[]'], ['member', 'ProjectMember[]'],
    ['environment', 'EnvironmentAsset[]'], ['knowledge', 'KnowledgeAsset[]'],
  ] as const)('declares and creates the %s list without an asset binding', (assetType, outputType) => {
    const operation = findAssetOperation(assetType, `${assetType}.list`)
    expect(isProjectAssetOperation(operation)).toBe(true)
    if (!isProjectAssetOperation(operation)) throw new Error('Expected project operation')
    expect(operation.contract).toMatchObject({ input: [], outputType })
    expect(operation.contract.exceptions.map(exception => exception.code)).toEqual([
      'asset.project-not-found', 'asset.operation-not-found', 'asset.invalid-input', 'asset.list-failed',
    ])
    assertFieldsDocumented(operation.contract.output)
    expect(() => assertWorkflowOperationOutput(operation.contract.output, [], operation.contract.outputType)).not.toThrow()
    expect(() => assertWorkflowOperationOutput(operation.contract.output, [{}], operation.contract.outputType)).toThrow()
    expect(() => assertWorkflowOperationOutput(operation.contract.output, { assets: [] }, operation.contract.outputType)).toThrow()
    const selection = { assetType, operationId: operation.id }
    expect(parseWorkflowNodeDragData(serializeWorkflowNodeDragData({ type: 'operation', selection })))
      .toEqual({ type: 'operation', selection })
    expect(parseWorkflowNodeDragData(JSON.stringify({ type: 'operation', selection: { ...selection, assetId: 'not-allowed' } }))).toBeNull()
    const draft = ref<WorkflowDefinition | null>(workflowFixture([], []))
    const selectedId = ref<string | null>(null)
    const selected = computed(() => draft.value?.nodes.find(node => node.id === selectedId.value) || null)
    const editor = useWorkflowOperationNodes(draft, selected, selectedId, ref(''))
    editor.addOperation(selection, { x: 480, y: 320 })
    editor.updateAssetSource('fixed')
    expect(selected.value).toMatchObject({ inputs: {}, assetSource: 'input', position: { x: 480, y: 320 } })
    expect(selected.value).not.toHaveProperty('assetId')
  })

  test('groups every workflow-ready operation by asset type and preserves group context during search', () => {
    const groups = workflowOperationGroups()
    expect(groups.map(group => group.label)).toEqual(['仓库', '成员', '环境', '知识'])
    expect(groups.flatMap(group => group.operations).length)
      .toBe(assetOperationConfig.modules.flatMap(module => module.operations).filter(operation => operation.workflow.enabled && !agentExecutorForOperation(operation.id)).length)
    expect(workflowOperationGroups('获取所有').map(group => group.operations.length)).toEqual([1, 1, 1, 1])
    expect(workflowOperationGroups('仓库克隆').map(group => group.operations.map(operation => operation.id))).toEqual([['repository.clone']])
    expect(workflowOperationGroups('does-not-match')).toEqual([])
  })

  test('provides typed array element paths, including nested member fields', () => {
    const operation = findAssetOperation('member', 'member.list')!
    if (!operation.workflow.enabled) throw new Error('Expected command')
    expect(assetOperationOutputFields(operation.contract).map(field => field.name)).toContain('0.user.name')
    const fields = [{ name: 'repositoryId', type: 'string' as const, required: true, description: 'Repository ID' }]
    expect(resolveWorkflowOperationInputs({ repositoryId: '$prev.0.id' }, fields, {}, [{ id: 'repo-1' }]))
      .toEqual({ repositoryId: 'repo-1' })
  })

  test('validates nested array fields and nullable values rather than only checking the outer array', () => {
    const fields: AssetOperationField[] = [
      { name: 'accounts', type: 'object[]', description: 'Environment accounts', fields: [{ name: 'account', type: 'string', description: 'Account name' }] },
      { name: 'localOperation', type: 'object', description: 'Local operation', nullable: true, fields: [{ name: 'status', type: 'string', description: 'Operation status' }] },
    ]
    expect(() => assertWorkflowOperationOutput(fields, [{ accounts: [{ account: 'tester' }], localOperation: null }], 'EnvironmentAsset[]')).not.toThrow()
    expect(() => assertWorkflowOperationOutput(fields, [{ accounts: [{ account: 42 }], localOperation: null }], 'EnvironmentAsset[]')).toThrow()
    expect(() => assertWorkflowOperationOutput(fields, [{ accounts: [], localOperation: [] }], 'EnvironmentAsset[]')).toThrow()
  })
})

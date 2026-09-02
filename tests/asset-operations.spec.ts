import { describe, expect, test } from 'vitest'
import {
  assetOperationConfig,
  assetOperationsForModule,
  findAssetOperation,
} from '../shared/config/asset-operations'
import { assetModuleIds } from '../shared/types/asset-operations'

describe('asset operation configuration', () => {
  test('defines operations for every asset module with unique stable IDs', () => {
    expect(assetOperationConfig.schemaVersion).toBe(1)
    expect(assetOperationConfig.modules.map(module => module.id)).toEqual(assetModuleIds)

    const operations = assetOperationConfig.modules.flatMap(module => module.operations)
    expect(new Set(operations.map(operation => operation.id)).size).toBe(operations.length)
    expect(assetModuleIds.every(moduleId => assetOperationsForModule(moduleId).length > 0)).toBe(true)
  })

  test('marks only server commands as workflow-ready', () => {
    const operations = assetOperationConfig.modules.flatMap(module => module.operations)
    const workflowOperations = operations.filter(operation => operation.workflow.enabled)

    expect(workflowOperations.map(operation => operation.id)).toEqual([
      'repository.clone',
      'repository.update',
      'repository.local-clone-status',
      'repository.create-worktree',
    ])
    expect(workflowOperations.every(operation => operation.execution.kind === 'command')).toBe(true)
    expect(findAssetOperation('repository', 'repository.clone')).toMatchObject({
      execution: { kind: 'command', command: 'repository.clone' },
      workflow: { enabled: true },
    })
    expect(findAssetOperation('repository', 'repository.create-worktree')).toMatchObject({
      execution: { kind: 'command', command: 'repository.create-worktree' },
      workflow: { enabled: true },
    })
    expect(findAssetOperation('environment', 'repository.clone')).toBeUndefined()
  })
})

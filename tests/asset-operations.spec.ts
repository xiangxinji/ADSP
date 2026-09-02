import { describe, expect, test } from 'vitest'
import {
  assetOperationConfig,
  assetOperationsForModule,
  findAssetOperation,
  primaryAssetOperationLimit,
} from '../shared/config/asset-operations'
import { assetModuleIds } from '../shared/types/asset-operations'

describe('asset operation configuration', () => {
  test('defines operations for every asset module with unique stable IDs', () => {
    expect(assetOperationConfig.schemaVersion).toBe(5)
    expect(assetOperationConfig.modules.map(module => module.id)).toEqual(assetModuleIds)

    const operations = assetOperationConfig.modules.flatMap(module => module.operations)
    expect(new Set(operations.map(operation => operation.id)).size).toBe(operations.length)
    expect(assetModuleIds.every(moduleId => assetOperationsForModule(moduleId).length > 0)).toBe(true)
    expect(assetOperationConfig.modules.every(module =>
      module.operations.filter(operation => operation.placement === 'primary').length <= primaryAssetOperationLimit,
    )).toBe(true)
  })

  test('marks only server commands as workflow-ready', () => {
    const operations = assetOperationConfig.modules.flatMap(module => module.operations)
    const workflowOperations = operations.filter(operation => operation.workflow.enabled)

    expect(workflowOperations.map(operation => operation.id)).toEqual([
      'repository.clone',
      'repository.update',
      'repository.local-clone-status',
      'repository.create-worktree',
      'repository.create-branch',
      'repository.create-merge-request',
    ])
    expect(workflowOperations.every(operation => operation.execution.kind === 'command')).toBe(true)
    expect(findAssetOperation('repository', 'repository.clone')).toMatchObject({
      execution: { kind: 'command', command: 'repository.clone' },
      workflow: { enabled: true },
      contract: {
        input: [{ name: 'repositoryId', type: 'string', required: true }],
        output: [
          { name: 'repositoryId', type: 'string' },
          { name: 'path', type: 'path' },
        ],
        exceptions: expect.arrayContaining([
          expect.objectContaining({ code: 'repository.local-copy-exists' }),
          expect.objectContaining({ code: 'repository.git-command-failed' }),
        ]),
      },
    })
    expect(findAssetOperation('repository', 'repository.create-worktree')).toMatchObject({
      execution: { kind: 'command', command: 'repository.create-worktree' },
      workflow: { enabled: true },
      contract: {
        input: expect.arrayContaining([
          expect.objectContaining({ name: 'branch', type: 'string', required: true }),
        ]),
        output: expect.arrayContaining([
          expect.objectContaining({ name: 'path', type: 'path' }),
        ]),
        exceptions: expect.arrayContaining([
          expect.objectContaining({ code: 'repository.invalid-worktree-branch' }),
          expect.objectContaining({ code: 'repository.branch-not-found' }),
        ]),
      },
    })
    expect(findAssetOperation('repository', 'repository.create-branch')).toMatchObject({
      execution: { kind: 'command', command: 'repository.create-branch' },
      workflow: { enabled: true },
      contract: {
        input: expect.arrayContaining([
          expect.objectContaining({ name: 'branch', type: 'string', required: true }),
          expect.objectContaining({ name: 'source', type: 'string', required: true }),
        ]),
        output: expect.arrayContaining([
          expect.objectContaining({ name: 'repositoryId', type: 'string' }),
          expect.objectContaining({ name: 'branch', type: 'string' }),
          expect.objectContaining({ name: 'source', type: 'string' }),
        ]),
        exceptions: expect.arrayContaining([
          expect.objectContaining({ code: 'repository.source-required' }),
          expect.objectContaining({ code: 'repository.provider-unsupported' }),
          expect.objectContaining({ code: 'repository.source-not-found' }),
          expect.objectContaining({ code: 'repository.branch-already-exists' }),
        ]),
      },
    })
    expect(findAssetOperation('repository', 'repository.create-merge-request')).toMatchObject({
      execution: { kind: 'command', command: 'repository.create-merge-request' },
      workflow: { enabled: true },
      contract: {
        input: expect.arrayContaining([
          expect.objectContaining({ name: 'source', type: 'string', required: true }),
          expect.objectContaining({ name: 'target', type: 'string', required: true }),
          expect.objectContaining({ name: 'title', type: 'string', required: true }),
        ]),
        output: expect.arrayContaining([
          expect.objectContaining({ name: 'mergeRequestId', type: 'string' }),
          expect.objectContaining({ name: 'mergeRequestNumber', type: 'string' }),
          expect.objectContaining({ name: 'webUrl', type: 'string' }),
        ]),
        exceptions: expect.arrayContaining([
          expect.objectContaining({ code: 'repository.merge-request-title-required' }),
          expect.objectContaining({ code: 'repository.merge-request-branches-equal' }),
          expect.objectContaining({ code: 'repository.source-not-found' }),
          expect.objectContaining({ code: 'repository.target-not-found' }),
          expect.objectContaining({ code: 'repository.merge-request-already-exists' }),
        ]),
      },
    })
    expect(findAssetOperation('environment', 'repository.clone')).toBeUndefined()
  })
})

import { describe, expect, test } from 'vitest'
import {
  parseWorkflowNodeDragData,
  serializeWorkflowNodeDragData,
  type WorkflowNodeDragData,
} from '../app/utils/workflow-node-drag'

describe('workflow node drag payload', () => {
  test.each<WorkflowNodeDragData>([
    { type: 'async' },
    {
      type: 'operation',
      selection: { assetType: 'repository', assetId: 'repo-1', operationId: 'repository.clone' },
    },
  ])('round-trips valid node data', (data) => {
    expect(parseWorkflowNodeDragData(serializeWorkflowNodeDragData(data))).toEqual(data)
  })

  test.each([
    '',
    'null',
    JSON.stringify({ type: 'control', kind: 'unknown' }),
    JSON.stringify({ type: 'operation', selection: { assetType: 'unknown', assetId: 'asset-1', operationId: 'run' } }),
    JSON.stringify({ type: 'operation', selection: { assetType: 'repository', assetId: '', operationId: 'run' } }),
  ])('rejects malformed or unsupported node data', (value) => {
    expect(parseWorkflowNodeDragData(value)).toBeNull()
  })
})

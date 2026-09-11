import { computed, ref } from 'vue'
import { describe, expect, test } from 'vitest'
import { useWorkflowOperationNodes } from '../app/composables/useWorkflowOperationNodes'
import { parseWorkflowNodeDragData, serializeWorkflowNodeDragData } from '../app/utils/workflow-node-drag'
import { workflowPreviousValueFields } from '../app/utils/workflow-value-fields'
import { workflowEdge, workflowFixture } from './support/workflow-fixtures'
import type { WorkflowOperationNode } from '../shared/types/asdp'

describe('agent workflow editor', () => {
  test.each(['repository.agent-codex', 'repository.agent-claude-code'])('drags %s and defaults to read-only with no references', operationId => {
    const draft = ref(workflowFixture([], []))
    const selectedId = ref<string | null>(null)
    const selected = computed(() => draft.value.nodes.find(node => node.id === selectedId.value) || null)
    const editor = useWorkflowOperationNodes(draft, selected, selectedId, ref(''))
    const selection = { assetType: 'repository' as const, operationId }
    expect(parseWorkflowNodeDragData(serializeWorkflowNodeDragData({ type: 'operation', selection }))).toEqual({ type: 'operation', selection })
    editor.addOperation(selection, { x: 300, y: 220 })
    expect(selected.value).toMatchObject({ operationId, assetSource: 'input', inputs: { writable: false, references: [], prompt: '' }, position: { x: 300, y: 220 } })
    expect(selected.value).not.toHaveProperty('assetId')
    editor.updateAssetSource('fixed')
    expect(selected.value).not.toHaveProperty('assetId')
  })

  test('offers the final text output to a downstream node', () => {
    const node: WorkflowOperationNode = { id: 'agent', assetType: 'repository', operationId: 'repository.agent-codex', inputs: {}, position: { x: 0, y: 0 } }
    const workflow = workflowFixture([node], [workflowEdge('agent', 'next')])
    expect(workflowPreviousValueFields(workflow, 'next').map(field => field.name)).toEqual(['text', 'executor', 'writable', 'durationMs'])
  })
})

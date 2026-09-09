import { computed, ref } from 'vue'
import { describe, expect, test } from 'vitest'
import { useWorkflowOperationNodes } from '../app/composables/useWorkflowOperationNodes'
import { parseWorkflowNodeDragData, serializeWorkflowNodeDragData } from '../app/utils/workflow-node-drag'
import type { WorkflowDefinition, WorkflowOperationNode } from '../shared/types/asdp'
import { workflowAssetSource } from '../shared/utils/workflow-operation-assets'
import { operationNode, workflowFixture } from './support/workflow-fixtures'

const setup = (nodes: WorkflowOperationNode[] = []) => {
  const draft = ref<WorkflowDefinition | null>(workflowFixture(nodes, []))
  const selectedNodeId = ref<string | null>(nodes[0]?.id || null)
  const selectedNode = computed(() => draft.value?.nodes.find(node => node.id === selectedNodeId.value) || null)
  const actionError = ref('')
  return { draft, selectedNode, selectedNodeId, actionError, ...useWorkflowOperationNodes(draft, selectedNode, selectedNodeId, actionError) }
}

describe('operation-first workflow editing', () => {
  test('drags an operation without a registered asset and defaults to input mode at the drop position', () => {
    const editor = setup()
    const data = { type: 'operation' as const, selection: { assetType: 'repository' as const, operationId: 'repository.clone' } }
    expect(parseWorkflowNodeDragData(serializeWorkflowNodeDragData(data))).toEqual(data)
    editor.addOperation(data.selection, { x: 650, y: 430 })
    expect(editor.selectedNode.value).toMatchObject({
      assetSource: 'input', operationId: 'repository.clone', inputs: { repositoryId: '' }, position: { x: 650, y: 430 },
    })
    expect(editor.selectedNode.value).not.toHaveProperty('assetId')
  })

  test('switches to a project asset and removes the binding when switching back to input', () => {
    const editor = setup()
    editor.addOperation({ assetType: 'repository', operationId: 'repository.create-branch' })
    const node = editor.selectedNode.value as WorkflowOperationNode
    node.inputs.repositoryId = '$prev.repositoryId'
    node.inputs.branch = '$root.branch'
    editor.updateAssetSource('fixed')
    expect(node.inputs.repositoryId).toBe('')
    editor.updateAssetId('repo-1')
    expect(node).toMatchObject({ assetSource: 'fixed', assetId: 'repo-1', inputs: { repositoryId: 'repo-1', branch: '$root.branch' } })
    editor.updateAssetSource('input')
    expect(node).not.toHaveProperty('assetId')
    expect(node.inputs).toMatchObject({ repositoryId: 'repo-1', branch: '$root.branch' })
    node.inputs.repositoryId = '$root.repositoryId'
    editor.updateAssetId('unexpected-fixed-id')
    expect(node.inputs.repositoryId).toBe('$root.repositoryId')
  })

  test('treats legacy saved nodes as fixed and new unbound nodes as input', () => {
    expect(workflowAssetSource(operationNode('legacy'))).toBe('fixed')
    expect(workflowAssetSource({})).toBe('input')
    const editor = setup([operationNode('legacy')])
    editor.updateAssetSource('input')
    expect(editor.selectedNode.value).not.toHaveProperty('assetId')
  })

  test('requires a trigger and rejects client-only or unknown operation payloads', () => {
    const editor = setup()
    editor.draft.value!.trigger = null
    editor.addOperation({ assetType: 'repository', operationId: 'repository.clone' })
    expect(editor.draft.value!.nodes).toEqual([])
    expect(editor.actionError.value).toContain('根触发器')
    for (const operationId of ['repository.edit', 'unknown']) {
      expect(parseWorkflowNodeDragData(JSON.stringify({ type: 'operation', selection: { assetType: 'repository', operationId } }))).toBeNull()
    }
  })
})

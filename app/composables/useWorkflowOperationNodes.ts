import type { Ref } from 'vue'
import { findAssetOperation } from '#shared/config/asset-operations'
import type { WorkflowDefinition, WorkflowNode, WorkflowNodePosition, WorkflowOperationInputValue, WorkflowOperationNode } from '#shared/types/asdp'
import { workflowNodeLimit } from '#shared/utils/workflow-nodes'
import { workflowAssetInputName, workflowAssetSource } from '#shared/utils/workflow-operation-assets'
import type { WorkflowOperationSelection } from '../utils/workflow-node-drag'

export const useWorkflowOperationNodes = (
  draft: Ref<WorkflowDefinition | null>,
  selectedNode: Ref<WorkflowNode | null>,
  selectedNodeId: Ref<string | null>,
  actionError: Ref<string>,
) => {
  const addOperation = (selection: WorkflowOperationSelection, position?: WorkflowNodePosition) => {
    if (!draft.value) return
    if (!draft.value.trigger) {
      actionError.value = '请先选择根触发器。'
      return
    }
    if (draft.value.nodes.length >= workflowNodeLimit) {
      actionError.value = '工作流最多支持 50 个节点。'
      return
    }
    const operation = findAssetOperation(selection.assetType, selection.operationId)
    if (!operation?.workflow.enabled) return
    const inputs: Record<string, WorkflowOperationInputValue> = {}
    operation.contract.input.forEach((field) => {
      inputs[field.name] = field.name === workflowAssetInputName(selection)
        ? selection.assetId || '' : field.type === 'boolean' ? false : ''
    })
    const previousPosition = draft.value.nodes.at(-1)?.position
    const node: WorkflowOperationNode = {
      id: globalThis.crypto.randomUUID(), ...selection, assetSource: selection.assetId ? 'fixed' : 'input', inputs,
      position: position || (previousPosition ? { x: previousPosition.x, y: previousPosition.y + 170 } : { x: 260, y: 250 }),
    }
    draft.value.nodes.push(node)
    selectedNodeId.value = node.id
    actionError.value = ''
  }

  const updateAssetSource = (source: 'input' | 'fixed') => {
    const node = selectedNode.value
    if (!node || !('inputs' in node) || workflowAssetSource(node) === source) return
    node.assetSource = source
    if (source === 'fixed') {
      node.assetId = ''
      node.inputs[workflowAssetInputName(node)] = ''
    } else {
      delete node.assetId
    }
  }

  const updateAssetId = (assetId: string) => {
    const node = selectedNode.value
    if (!node || !('inputs' in node) || workflowAssetSource(node) !== 'fixed') return
    node.assetId = assetId
    node.inputs[workflowAssetInputName(node)] = assetId
  }

  return { addOperation, updateAssetSource, updateAssetId }
}

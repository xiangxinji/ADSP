import type { Ref } from 'vue'
import type { WorkflowDefinition } from '#shared/types/asdp'
import { workflowBranchLimit, workflowNodeLimit } from '#shared/utils/workflow-nodes'

export const useWorkflowAsyncNodes = (
  draft: Ref<WorkflowDefinition | null>,
  selectedNodeId: Ref<string | null>,
  actionError: Ref<string>,
) => {
  const findAsyncNode = (nodeId: string) => {
    const node = draft.value?.nodes.find(node => node.id === nodeId)
    return node?.kind === 'async' ? node : null
  }
  const newBranch = (label: string) => ({ id: globalThis.crypto.randomUUID(), label })

  const addAsyncNode = () => {
    if (!draft.value) return
    if (!draft.value.trigger || draft.value.nodes.length >= workflowNodeLimit) {
      actionError.value = !draft.value.trigger ? '请先选择根触发器。' : '工作流最多支持 50 个节点。'
      return
    }
    const previous = draft.value.nodes.at(-1)?.position || draft.value.trigger.position
    const node = {
      id: globalThis.crypto.randomUUID(), kind: 'async' as const, label: '异步执行',
      branches: [newBranch('子流程 1'), newBranch('子流程 2')],
      position: { x: previous.x, y: previous.y + 220 },
    }
    draft.value.nodes.push(node)
    selectedNodeId.value = node.id
    actionError.value = ''
  }

  const addAsyncBranch = (nodeId: string) => {
    const node = findAsyncNode(nodeId)
    if (!node) return
    if (node.branches.length >= workflowBranchLimit) {
      actionError.value = '每个异步节点最多支持 50 个子端点。'
      return
    }
    let number = node.branches.length + 1
    while (node.branches.some(branch => branch.label === '子流程 ' + number)) number += 1
    node.branches.push(newBranch('子流程 ' + number))
    actionError.value = ''
  }

  const updateAsyncLabel = (nodeId: string, label: string) => {
    const node = findAsyncNode(nodeId)
    if (node) node.label = label
  }
  const renameAsyncBranch = (nodeId: string, branchId: string, label: string) => {
    const branch = findAsyncNode(nodeId)?.branches.find(branch => branch.id === branchId)
    if (branch) branch.label = label
  }
  const removeAsyncBranch = (nodeId: string, branchId: string) => {
    const node = findAsyncNode(nodeId)
    if (!draft.value || !node || !node.branches.some(branch => branch.id === branchId)) return
    if (node.branches.length === 1) {
      actionError.value = '异步节点至少保留一个子端点。'
      return
    }
    node.branches = node.branches.filter(branch => branch.id !== branchId)
    draft.value.edges = draft.value.edges.filter(edge => edge.source !== nodeId || edge.sourceHandle !== branchId)
    actionError.value = ''
  }
  return { addAsyncNode, addAsyncBranch, updateAsyncLabel, renameAsyncBranch, removeAsyncBranch }
}

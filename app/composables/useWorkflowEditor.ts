import type { Ref } from 'vue'
import { findAssetOperation } from '#shared/config/asset-operations'
import type { AssetType } from '#shared/types/asset-operations'
import type { ProjectWorkspace, WorkflowDefinition, WorkflowOperationInputValue } from '#shared/types/asdp'
import { analyzeWorkflowGraph } from '#shared/utils/workflow-graph'
import { isWorkflowControlNode, isWorkflowOperationNode, isWorkflowSubworkflowNode, validateWorkflowControlNode, validateWorkflowSubworkflowNode } from '#shared/utils/workflow-nodes'
import { analyzeWorkflowReferences } from '#shared/utils/workflow-references'
import { workflowAssetSource } from '#shared/utils/workflow-operation-assets'
import { workflowValueReferenceError } from '#shared/utils/workflow-values'
import { workflowTriggerFilterError } from '#shared/utils/workflow-triggers'

const cloneWorkflow = (workflow: WorkflowDefinition): WorkflowDefinition => structuredClone(toRaw(workflow))

export const useWorkflowEditor = (workflowId: string, workspace: Ref<ProjectWorkspace | null | undefined>) => {
  const sourceWorkflow = workspace.value?.workflows.find(workflow => workflow.id === workflowId)
  if (workspace.value && !sourceWorkflow) throw createError({ statusCode: 404, statusMessage: '工作流不存在' })

  const draft = ref<WorkflowDefinition | null>(sourceWorkflow ? cloneWorkflow(sourceWorkflow) : null)
  const savedSnapshot = ref(draft.value ? JSON.stringify(draft.value) : '')
  const selectedNodeId = ref<string | null>(null)
  const saving = ref(false)
  const actionError = ref('')
  const { success } = useAppToast()
  const selectedNode = computed(() => draft.value?.nodes.find(node => node.id === selectedNodeId.value) || null)
  const dirty = computed(() => Boolean(draft.value && JSON.stringify(draft.value) !== savedSnapshot.value))
  const { connectEdge, removeEdge, setUpstream } = useWorkflowConnections(draft, selectedNode, actionError)
  const controlNodes = useWorkflowControlNodes(draft, selectedNodeId, actionError)
  const exceptionPorts = useWorkflowExceptionPorts(draft, selectedNodeId, actionError)
  const operationNodes = useWorkflowOperationNodes(draft, selectedNode, selectedNodeId, actionError)
  const subworkflows = useWorkflowSubworkflows(draft, workspace, selectedNodeId, actionError)
  const trigger = useWorkflowTrigger(draft)

  const assetExists = (assetType: AssetType, assetId?: string) => {
    if (!workspace.value) return false
    if (assetType === 'repository') return workspace.value.repositories.some(asset => asset.id === assetId)
    if (assetType === 'member') return workspace.value.members.some(asset => asset.id === assetId)
    if (assetType === 'environment') return workspace.value.environments.some(asset => asset.id === assetId)
    return workspace.value.knowledge.some(asset => asset.id === assetId)
  }

  const validationMessage = computed(() => {
    if (!draft.value?.name.trim()) return '请填写工作流名称。'
    if (!draft.value.trigger) return '请选择一个根触发器。'
    const filterError = workflowTriggerFilterError(draft.value.trigger)
    if (filterError) return filterError
    if (draft.value.trigger.statusIds?.some(id => !workspace.value?.requirementStatuses.some(status => status.id === id))) {
      return '请取消已删除或不属于当前项目的目标状态。'
    }
    for (const node of draft.value.nodes) {
      if (isWorkflowSubworkflowNode(node)) {
        const message = validateWorkflowSubworkflowNode(node)
        if (message) return message
        continue
      }
      if (isWorkflowControlNode(node)) {
        const message = validateWorkflowControlNode(node)
        if (message) return message
        continue
      }
      const operation = findAssetOperation(node.assetType, node.operationId)
      if (workflowAssetSource(node) === 'fixed' && !assetExists(node.assetType, node.assetId)) return '请选择当前项目中的固定资产。'
      if (!operation?.workflow.enabled) return '存在不可用于工作流的资产操作。'
      const invalidReference = Object.values(node.inputs).map(workflowValueReferenceError).find(Boolean)
      if (invalidReference) return invalidReference
      const missing = operation.contract.input.find(field => field.required && (node.inputs[field.name] === undefined || node.inputs[field.name] === ''))
      if (missing) return `节点“${operation.label}”缺少参数 ${missing.name}。`
    }
    return analyzeWorkflowReferences(draft.value, id => workspace.value?.workflows.find(workflow => workflow.id === id)).error?.message
      || analyzeWorkflowGraph(draft.value.nodes, draft.value.edges, Boolean(draft.value.trigger)).message
  })

  const updatePosition = (id: string, position: { x: number, y: number }) => {
    if (!draft.value) return
    if (id === 'workflow-trigger' && draft.value.trigger) draft.value.trigger.position = position
    const node = draft.value.nodes.find(item => item.id === id)
    if (node) node.position = position
  }

  const updateInput = (name: string, value: WorkflowOperationInputValue) => {
    if (isWorkflowOperationNode(selectedNode.value)) selectedNode.value.inputs[name] = value
  }

  const removeNode = () => {
    if (!draft.value || !selectedNode.value) return
    const removedId = selectedNode.value.id
    draft.value.nodes = draft.value.nodes.filter(node => node.id !== removedId)
    draft.value.edges = draft.value.edges.filter(edge => edge.source !== removedId && edge.target !== removedId)
    selectedNodeId.value = null
  }

  const save = async () => {
    if (!draft.value || validationMessage.value || saving.value) return false
    saving.value = true
    actionError.value = ''
    try {
      const workflow = await $fetch<WorkflowDefinition>(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        body: {
          name: draft.value.name, note: draft.value.note, trigger: draft.value.trigger,
          nodes: draft.value.nodes, edges: draft.value.edges,
        },
      })
      draft.value = cloneWorkflow(workflow)
      savedSnapshot.value = JSON.stringify(draft.value)
      success('工作流已保存')
      return true
    } catch (error: any) {
      actionError.value = error?.data?.statusMessage || error?.message || '保存工作流失败'
      return false
    } finally {
      saving.value = false
    }
  }

  onBeforeRouteLeave(() => !dirty.value || window.confirm('工作流还有未保存的修改，确定离开吗？'))
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!dirty.value) return
    event.preventDefault()
    event.returnValue = ''
  }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

  return {
    ...trigger,
    ...subworkflows,
    ...controlNodes,
    ...exceptionPorts,
    ...operationNodes,
    draft, selectedNodeId, selectedNode, dirty, saving, actionError, validationMessage,
    save, updatePosition, updateInput, removeNode, connectEdge, removeEdge, setUpstream,
  }
}

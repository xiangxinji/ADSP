import { randomUUID } from 'node:crypto'
import { findAssetOperation } from '../../shared/config/asset-operations'
import type { AssetOperationField } from '../../shared/types/asset-operations'
import {
  workflowTriggerKinds,
  type CreateWorkflowInput,
  type UpdateWorkflowInput,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowOperationInputValue,
  type WorkflowOperationNode,
  type WorkflowNode,
  type WorkflowTrigger,
} from '../../shared/types/asdp'
import { analyzeWorkflowGraph } from '../../shared/utils/workflow-graph'
import { validateAsyncWorkflowNode, workflowNodeLimit } from '../../shared/utils/workflow-nodes'
import { parseWorkflowValueReference, workflowValueReferenceError } from '../../shared/utils/workflow-values'
import { workflowAssetSource } from '../../shared/utils/workflow-operation-assets'
import {
  findWorkflowDefinition,
  insertWorkflowDefinition,
  listWorkflowDefinitions,
  removeWorkflowDefinition,
  removeWorkflowDefinitionsForProject,
  updateWorkflowDefinitionRecord,
} from '../repositories/workflow-definitions'
import { badRequest, requireEntity } from './errors'
import { getProject } from './projects'
import { workflowAssetProjectId } from './workflow-asset-resolution'
import { assertProjectWorkflowsIdle, assertWorkflowIdle } from './workflow-runs'

const positionLimit = 100_000

const getWorkflowRecord = (id: string) => requireEntity(
  findWorkflowDefinition(id),
  'Workflow not found',
)

const validatePosition = (position: { x: number, y: number }, field: string) => {
  if (![position.x, position.y].every(value => Number.isFinite(value) && Math.abs(value) <= positionLimit)) {
    throw badRequest(`${field} must contain finite canvas coordinates`)
  }
  return { x: position.x, y: position.y }
}

const validateTrigger = (trigger: WorkflowTrigger | null) => {
  if (!trigger) return null
  if (!workflowTriggerKinds.includes(trigger.kind)) throw badRequest('Unsupported workflow trigger')
  return { ...trigger, position: validatePosition(trigger.position, 'trigger.position') }
}

const validateOperationInputs = (
  node: WorkflowOperationNode,
  contractFields: readonly AssetOperationField[],
) => {
  const allowedNames = new Set(contractFields.map(field => field.name))
  const unknownName = Object.keys(node.inputs).find(name => !allowedNames.has(name))
  if (unknownName) throw badRequest(`Workflow node input is not declared: ${unknownName}`)

  const inputs: Record<string, WorkflowOperationInputValue> = {}
  contractFields.forEach((field) => {
    const value = node.inputs[field.name]
    if (field.required && (value === undefined || (typeof value === 'string' && !value.trim()))) {
      throw badRequest(`Workflow node input is required: ${field.name}`)
    }
    if (value === undefined) return
    const referenceError = workflowValueReferenceError(value)
    if (referenceError) throw badRequest(referenceError)
    const reference = parseWorkflowValueReference(value)
    if (field.type === 'boolean') {
      if (typeof value !== 'boolean' && !reference) throw badRequest(`Workflow node input must be boolean: ${field.name}`)
      inputs[field.name] = typeof value === 'string' ? value.trim() : value
      return
    }
    if (typeof value !== 'string') throw badRequest(`Workflow node input must be a string: ${field.name}`)
    inputs[field.name] = value.trim()
  })
  return inputs
}

const validateNode = (projectId: string, node: WorkflowNode): WorkflowNode => {
  if (!node.id.trim()) throw badRequest('Workflow node id is required')
  if (node.kind === 'async') {
    const message = validateAsyncWorkflowNode(node)
    if (message) throw badRequest(message)
    return {
      ...node, label: node.label.trim(),
      branches: node.branches.map(branch => ({ ...branch, label: branch.label.trim() })),
      position: validatePosition(node.position, 'node.position'),
    }
  }
  const operation = findAssetOperation(node.assetType, node.operationId)
  if (!operation?.workflow.enabled || operation.execution.kind !== 'command') {
    throw badRequest('Asset operation is not available to workflows')
  }
  const inputs = validateOperationInputs(node, operation.contract.input)
  const assetIdField = `${node.assetType}Id`
  const assetSource = workflowAssetSource(node)
  if (assetSource === 'fixed') {
    if (!node.assetId?.trim()) throw badRequest('Workflow fixed assetId is required')
    if (workflowAssetProjectId(node.assetType, node.assetId) !== projectId) throw badRequest('Workflow assets must belong to the same project')
    if (inputs[assetIdField] !== node.assetId) throw badRequest(`Workflow ${assetIdField} must match the selected asset`)
  } else if (node.assetId !== undefined) {
    throw badRequest('Input asset source must not include a fixed assetId')
  }
  return {
    ...node,
    assetSource,
    inputs,
    position: validatePosition(node.position, 'node.position'),
  }
}

const validateDefinition = (
  projectId: string,
  trigger: WorkflowTrigger | null,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
) => {
  if (nodes.length > workflowNodeLimit) throw badRequest(`Workflow supports at most ${workflowNodeLimit} operation nodes`)
  if (nodes.length && !trigger) throw badRequest('A root trigger is required before adding operation nodes')
  if (new Set(nodes.map(node => node.id)).size !== nodes.length) throw badRequest('Workflow node ids must be unique')
  const validatedNodes = nodes.map(node => validateNode(projectId, node))
  const validatedEdges = edges.map(edge => ({
    id: edge.id.trim(),
    source: edge.source.trim(),
    target: edge.target.trim(),
    ...(edge.sourceHandle === undefined ? {} : { sourceHandle: edge.sourceHandle.trim() }),
  }))
  const graph = analyzeWorkflowGraph(validatedNodes, validatedEdges, Boolean(trigger))
  if (graph.message) throw badRequest(graph.message)
  const nodesById = new Map(validatedNodes.map(node => [node.id, node]))
  return {
    trigger: validateTrigger(trigger),
    nodes: graph.orderedNodeIds.map(nodeId => nodesById.get(nodeId) as WorkflowNode),
    edges: validatedEdges,
  }
}

export const getWorkflow = (id: string) => getWorkflowRecord(id)

export const validateWorkflowForExecution = (workflow: WorkflowDefinition): WorkflowDefinition => ({
  ...workflow,
  ...validateDefinition(workflow.projectId, workflow.trigger, workflow.nodes, workflow.edges),
})

export const listProjectWorkflows = (projectId: string) => listWorkflowDefinitions(projectId)

export const createWorkflow = (projectId: string, input: CreateWorkflowInput) => {
  getProject(projectId)
  const timestamp = new Date().toISOString()
  const workflow: WorkflowDefinition = {
    id: randomUUID(),
    projectId,
    name: input.name,
    note: input.note,
    trigger: null,
    nodes: [],
    edges: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  insertWorkflowDefinition(workflow)
  return getWorkflow(workflow.id)
}

export const updateWorkflow = (id: string, input: UpdateWorkflowInput) => {
  const current = getWorkflowRecord(id)
  const definition = validateDefinition(
    current.projectId,
    input.trigger === undefined ? current.trigger : input.trigger,
    input.nodes ?? current.nodes,
    input.edges ?? current.edges,
  )
  updateWorkflowDefinitionRecord({
    ...current,
    name: input.name ?? current.name,
    note: input.note ?? current.note,
    ...definition,
    updatedAt: new Date().toISOString(),
  })
  return getWorkflow(id)
}

export const deleteWorkflow = (id: string) => {
  getWorkflowRecord(id)
  assertWorkflowIdle(id)
  removeWorkflowDefinition(id)
}

export const deleteProjectWorkflows = (projectId: string) => {
  assertProjectWorkflowsIdle(projectId)
  removeWorkflowDefinitionsForProject(projectId)
}

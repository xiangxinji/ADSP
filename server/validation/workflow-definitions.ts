import {
  workflowTriggerKinds,
  type CreateWorkflowInput,
  type UpdateWorkflowInput,
  type WorkflowEdge,
  type WorkflowOperationInputValue,
  type WorkflowNode,
  type WorkflowTrigger,
} from '../../shared/types/asdp'
import { assetTypes, type AssetType } from '../../shared/types/asset-operations'
import { bodyObject, optionalText, requiredText } from '../utils/http-input'

const workflowName = (value: unknown) => {
  const name = requiredText(value, 'name')
  if (name.length > 100) throw createError({ statusCode: 400, statusMessage: 'name must be at most 100 characters' })
  return name
}

const workflowNote = (value: unknown) => {
  const note = optionalText(value)
  if (note.length > 500) throw createError({ statusCode: 400, statusMessage: 'note must be at most 500 characters' })
  return note
}

const positionPayload = (value: unknown, field: string) => {
  const position = bodyObject(value)
  if (typeof position.x !== 'number' || typeof position.y !== 'number') {
    throw createError({ statusCode: 400, statusMessage: `${field} must contain x and y numbers` })
  }
  return { x: position.x, y: position.y }
}

const triggerPayload = (value: unknown): WorkflowTrigger | null => {
  if (value === null) return null
  const trigger = bodyObject(value)
  if (typeof trigger.kind !== 'string' || !workflowTriggerKinds.includes(trigger.kind as WorkflowTrigger['kind'])) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported workflow trigger' })
  }
  return {
    kind: trigger.kind as WorkflowTrigger['kind'],
    position: positionPayload(trigger.position, 'trigger.position'),
  }
}

const inputsPayload = (value: unknown) => {
  const inputs = bodyObject(value)
  if (Object.values(inputs).some(input => typeof input !== 'string' && typeof input !== 'boolean')) {
    throw createError({ statusCode: 400, statusMessage: 'Workflow node inputs must be strings or booleans' })
  }
  return inputs as Record<string, WorkflowOperationInputValue>
}

const nodePayload = (value: unknown): WorkflowNode => {
  const node = bodyObject(value)
  if (node.kind === 'async') {
    if (!Array.isArray(node.branches)) throw createError({ statusCode: 400, statusMessage: 'branches must be an array' })
    return {
      id: requiredText(node.id, 'node.id'),
      kind: 'async',
      label: requiredText(node.label, 'node.label'),
      branches: node.branches.map((value) => {
        const branch = bodyObject(value)
        return { id: requiredText(branch.id, 'branch.id'), label: requiredText(branch.label, 'branch.label') }
      }),
      position: positionPayload(node.position, 'node.position'),
    }
  }
  if (node.kind !== undefined && node.kind !== 'operation') {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported workflow node kind' })
  }
  if (typeof node.assetType !== 'string' || !assetTypes.includes(node.assetType as AssetType)) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported workflow asset type' })
  }
  return {
    id: requiredText(node.id, 'node.id'),
    assetType: node.assetType as AssetType,
    assetId: requiredText(node.assetId, 'node.assetId'),
    operationId: requiredText(node.operationId, 'node.operationId'),
    inputs: inputsPayload(node.inputs),
    ...(node.exceptionPorts === undefined ? {} : { exceptionPorts: exceptionPortsPayload(node.exceptionPorts) }),
    position: positionPayload(node.position, 'node.position'),
  }
}

const exceptionPortsPayload = (value: unknown) => {
  if (!Array.isArray(value)) throw createError({ statusCode: 400, statusMessage: 'exceptionPorts must be an array' })
  return value.map(value => {
    const port = bodyObject(value)
    return { id: requiredText(port.id, 'exceptionPort.id'), code: requiredText(port.code, 'exceptionPort.code') }
  })
}

const nodesPayload = (value: unknown) => {
  if (!Array.isArray(value)) throw createError({ statusCode: 400, statusMessage: 'nodes must be an array' })
  return value.map(nodePayload)
}

const edgePayload = (value: unknown): WorkflowEdge => {
  const edge = bodyObject(value)
  return {
    id: requiredText(edge.id, 'edge.id'),
    source: requiredText(edge.source, 'edge.source'),
    target: requiredText(edge.target, 'edge.target'),
    ...(edge.sourceHandle === undefined || edge.sourceHandle === null
      ? {} : { sourceHandle: requiredText(edge.sourceHandle, 'edge.sourceHandle') }),
  }
}

const edgesPayload = (value: unknown) => {
  if (!Array.isArray(value)) throw createError({ statusCode: 400, statusMessage: 'edges must be an array' })
  return value.map(edgePayload)
}

export const createWorkflowPayload = (value: unknown): CreateWorkflowInput => {
  const body = bodyObject(value)
  return { name: workflowName(body.name), note: workflowNote(body.note) }
}

export const updateWorkflowPayload = (value: unknown): UpdateWorkflowInput => {
  const body = bodyObject(value)
  return {
    name: body.name === undefined ? undefined : workflowName(body.name),
    note: body.note === undefined ? undefined : workflowNote(body.note),
    trigger: body.trigger === undefined ? undefined : triggerPayload(body.trigger),
    nodes: body.nodes === undefined ? undefined : nodesPayload(body.nodes),
    edges: body.edges === undefined ? undefined : edgesPayload(body.edges),
  }
}

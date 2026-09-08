import type { WorkflowAsyncNode, WorkflowDefinition, WorkflowEdge, WorkflowNode, WorkflowOperationNode } from '../../shared/types/asdp'
import type { WorkflowRun } from '../../shared/types/workflow-runs'

export const asyncNode = (id = 'parallel'): WorkflowAsyncNode => ({
  id, kind: 'async', label: '异步执行', position: { x: 120, y: 160 },
  branches: [{ id: 'first', label: '子流程 1' }, { id: 'second', label: '子流程 2' }],
})
export const operationNode = (id: string, repositoryId = id, branch = 'feature/' + id, source = 'main'): WorkflowOperationNode => ({
  id, assetType: 'repository', assetId: repositoryId, operationId: 'repository.create-branch',
  inputs: { repositoryId, branch, source }, position: { x: 440, y: 160 },
})
export const workflowEdge = (source: string, target: string, sourceHandle?: string): WorkflowEdge => ({
  id: [source, sourceHandle || 'next', target].join('-'), source, target,
  ...(sourceHandle ? { sourceHandle } : {}),
})
export const workflowFixture = (nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowDefinition => ({
  id: 'workflow-1', projectId: 'project-1', name: '异步测试', note: '',
  trigger: { kind: 'manual', position: { x: 120, y: 0 } }, nodes, edges,
  createdAt: '', updatedAt: '',
})
export const runFixture = (nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowRun => ({
  id: 'run-1', workflowId: 'workflow-1', root: {}, status: 'running', workflow: workflowFixture(nodes, edges),
  startedAt: new Date().toISOString(), finishedAt: null,
  steps: nodes.map(node => ({ nodeId: node.id, status: 'pending', startedAt: null, finishedAt: null, resolvedInputs: null, output: null, error: null })),
})

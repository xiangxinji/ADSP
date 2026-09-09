import type { WorkflowAsyncNode, WorkflowDefinition, WorkflowEdge, WorkflowNode, WorkflowOperationNode, WorkflowSyncNode } from '../../shared/types/asdp'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { workflowControlBranch } from '../../shared/utils/workflow-nodes'

export const asyncNode = (id = 'parallel'): WorkflowAsyncNode => ({
  id, kind: 'async', label: '异步执行', position: { x: 120, y: 160 },
  branches: [{ ...workflowControlBranch }],
})
export const syncNode = (id = 'sequence'): WorkflowSyncNode => ({ ...asyncNode(id), kind: 'sync', label: '同步执行' })
export const listNode = (id = 'items'): WorkflowOperationNode => ({
  id, assetType: 'repository', assetSource: 'input', operationId: 'repository.list', inputs: {}, position: { x: 0, y: 0 },
})
export const repositoryListItem = (id: string) => ({
  id, projectId: 'project-1', name: 'feature/' + id, note: '', provider: 'gitlab' as const,
  branchStrategy: 'multi-version' as const, externalId: '101', url: 'https://example.test/repo.git',
  localOperation: null, referenceCount: 0, createdAt: '', updatedAt: '',
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

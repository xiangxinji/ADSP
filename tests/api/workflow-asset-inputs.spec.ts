import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { Project, ProjectWorkspace, RepositoryAsset, WorkflowDefinition, WorkflowOperationNode } from '../../shared/types/asdp'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'

let harness: ApiTestHarness
let repositoryId: string
let foreignRepositoryId: string

const node = (id: string, assetInput: string): WorkflowOperationNode => ({
  id, assetType: 'repository', assetSource: 'input', operationId: 'repository.create-branch',
  inputs: { repositoryId: assetInput, branch: 'feature/' + id, source: 'main' }, position: { x: 200, y: 180 },
})

const configure = async (nodes: unknown[]) => {
  const created = await harness.request<WorkflowDefinition>('/api/projects/project-asdp/workflows', {
    method: 'POST', body: { name: '资产输入测试', note: '' },
  })
  return harness.request<WorkflowDefinition>(`/api/workflows/${created.data.id}`, {
    method: 'PATCH', body: {
      trigger: { kind: 'manual', position: { x: 200, y: 0 } }, nodes,
      edges: nodes.map((value, index) => ({
        id: 'edge-' + index, source: index ? (nodes[index - 1] as WorkflowOperationNode).id : 'workflow-trigger',
        target: (value as WorkflowOperationNode).id,
      })),
    },
  })
}

const execute = async (workflow: WorkflowDefinition, root: Record<string, unknown> = {}) => {
  const started = await harness.request<WorkflowRun>(`/api/workflows/${workflow.id}/runs`, { method: 'POST', body: { root } })
  expect(started.status).toBe(202)
  let run: WorkflowRun | undefined
  await expect.poll(async () => {
    run = (await harness.request<WorkflowRun[]>(`/api/workflows/${workflow.id}/runs`)).data[0]
    return run?.status
  }).not.toBe('running')
  return run!
}

describe('workflow asset inputs', () => {
  beforeAll(async () => {
    harness = await startApiTestHarness()
    expect((await harness.request('/api/settings/gitlab', {
      method: 'PUT', body: { baseUrl: harness.gitLabBaseUrl, token: 'valid-token' },
    })).status).toBe(200)
    const project = await harness.request<Project>('/api/projects', { method: 'POST', body: { name: '其他资产项目', description: '' } })
    expect(project.status).toBe(201)
    const createRepository = async (projectId: string, name: string) => {
      const response = await harness.request<RepositoryAsset>(`/api/projects/${projectId}/repositories`, {
        method: 'POST', body: { name, provider: 'gitlab', externalId: '101', url: `${harness.gitLabBaseUrl}/forgepilot/${name}.git` },
      })
      expect(response.status).toBe(201)
      return response.data.id
    }
    repositoryId = await createRepository('project-asdp', 'dynamic-assets')
    foreignRepositoryId = await createRepository(project.data.id, 'foreign-assets')
  })

  afterAll(async () => { await harness?.stop() })

  test('saves asset-free operation nodes, resolves root and previous asset IDs and persists run inputs', async () => {
    const configured = await configure([node('root-asset', '$root.repository.id'), node('previous-asset', '$prev.repositoryId')])
    expect(configured.status).toBe(200)
    expect(configured.data.nodes.every(value => !('assetId' in value))).toBe(true)
    const reloaded = await harness.request<ProjectWorkspace>('/api/projects/project-asdp')
    expect(reloaded.data.workflows.find(workflow => workflow.id === configured.data.id)?.nodes).toEqual(configured.data.nodes)
    const run = await execute(configured.data, { repository: { id: repositoryId } })
    expect(run.status).toBe('succeeded')
    for (const step of run.steps) {
      expect(step.resolvedInputs?.repositoryId).toBe(repositoryId)
      expect(step.output).toMatchObject({ repositoryId })
    }
  })

  test('supports literal input IDs and legacy fixed-asset definitions', async () => {
    const legacy = { ...node('legacy-asset', repositoryId), assetSource: undefined, assetId: repositoryId }
    const configured = await configure([node('literal-asset', repositoryId), legacy])
    expect(configured.status).toBe(200)
    expect(configured.data.nodes[1]).toMatchObject({ assetSource: 'fixed', assetId: repositoryId })
    expect((await execute(configured.data)).status).toBe('succeeded')
  })

  test.each([
    ['cross-project', () => foreignRepositoryId, 'workflow.asset-project-mismatch'],
    ['missing-asset', () => 'repository-does-not-exist', 'repository.not-found'],
    ['empty-asset', () => '   ', 'workflow.asset-input-invalid'],
    ['wrong-type', () => true, 'workflow.input-type-mismatch'],
  ])('rejects %s before any provider request', async (id, value, code) => {
    const configured = await configure([node(id, '$root.repositoryId')])
    expect(configured.status).toBe(200)
    const count = harness.gitLabRequests.length
    const run = await execute(configured.data, { repositoryId: value() })
    expect(run.status).toBe('failed')
    expect(run.steps[0].error?.code).toBe(code)
    expect(harness.gitLabRequests).toHaveLength(count)
  })

  test('retains clone operation errors with input-based assets', async () => {
    const clone = { ...node('clone-asset', '$root.repositoryId'), operationId: 'repository.clone', inputs: { repositoryId: '$root.repositoryId' } }
    const configured = await configure([clone])
    expect(configured.status).toBe(200)
    const run = await execute(configured.data, { repositoryId })
    expect(run.steps[0].error?.code).toBe('repository.workspace-not-configured')
  })

  test('rejects ambiguous sources, missing fixed IDs, mismatches and blank inputs', async () => {
    for (const invalid of [
      { ...node('ambiguous', repositoryId), assetId: repositoryId },
      { ...node('unsupported', repositoryId), assetSource: 'remote' },
      { ...node('no-fixed-id', repositoryId), assetSource: 'fixed' },
      { ...node('mismatch', '$root.repositoryId'), assetSource: 'fixed', assetId: repositoryId },
      { ...node('foreign-fixed', foreignRepositoryId), assetSource: 'fixed', assetId: foreignRepositoryId },
      node('blank', '   '),
    ]) expect((await configure([invalid])).status).toBe(400)
  })
})

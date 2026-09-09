import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { findAssetOperation, isProjectAssetOperation } from '../../shared/config/asset-operations'
import type { AssetOperationField, AssetType } from '../../shared/types/asset-operations'
import type { Project, ProjectWorkspace, UserAccount, WorkflowDefinition, WorkflowOperationNode } from '../../shared/types/asdp'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { assertWorkflowOperationOutput } from '../../server/services/workflow-value-resolution'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'

let harness: ApiTestHarness
let projectId: string
let foreignProjectId: string
let emptyProjectId: string
let workspace: ProjectWorkspace
const modules = [
  ['repository', 'repositories'], ['member', 'members'], ['environment', 'environments'], ['knowledge', 'knowledge'],
] as const

const listPath = (id: string, type: string, operationId = `${type}.list`) => `/api/projects/${id}/assets/${type}/operations/${operationId}`
const listNode = (assetType: AssetType): WorkflowOperationNode => ({
  id: `${assetType}-list`, assetType, operationId: `${assetType}.list`, assetSource: 'input', inputs: {}, position: { x: 200, y: 180 },
})
const createWorkflow = async (id: string, nodes: WorkflowOperationNode[]) => {
  const created = await harness.request<WorkflowDefinition>(`/api/projects/${id}/workflows`, { method: 'POST', body: { name: '资产数组工作流', note: '' } })
  expect(created.status).toBe(201)
  const configured = await harness.request<WorkflowDefinition>(`/api/workflows/${created.data.id}`, {
    method: 'PATCH', body: {
      trigger: { kind: 'manual', position: { x: 200, y: 0 } }, nodes,
      edges: nodes.map((node, index) => ({ id: `edge-${index}`, source: nodes[index - 1]?.id || 'workflow-trigger', target: node.id })),
    },
  })
  expect(configured.status).toBe(200)
  return configured.data
}
const runWorkflow = async (workflow: WorkflowDefinition) => {
  const started = await harness.request<WorkflowRun>(`/api/workflows/${workflow.id}/runs`, { method: 'POST' })
  expect(started.status).toBe(202)
  let run: WorkflowRun | undefined
  await expect.poll(async () => {
    run = (await harness.request<WorkflowRun[]>(`/api/workflows/${workflow.id}/runs`)).data[0]
    return run?.status
  }).not.toBe('running')
  return run!
}
const assertDeclaredKeys = (fields: readonly AssetOperationField[], value: Record<string, unknown>) => {
  expect(Object.keys(value).sort()).toEqual(fields.map(field => field.name).sort())
  for (const field of fields) {
    const nested = value[field.name]
    if (!field.fields || nested === null) continue
    for (const item of Array.isArray(nested) ? nested : [nested]) assertDeclaredKeys(field.fields, item as Record<string, unknown>)
  }
}

describe('project asset collection API and workflow execution', () => {
  beforeAll(async () => {
    harness = await startApiTestHarness()
    const createProject = async (name: string) => {
      const response = await harness.request<Project>('/api/projects', { method: 'POST', body: { name, description: '' } })
      expect(response.status).toBe(201)
      return response.data.id
    }
    projectId = await createProject('资产列表测试项目')
    foreignProjectId = await createProject('隔离项目')
    emptyProjectId = await createProject('空资产项目')
    const addAssets = async (id: string, suffix: string) => {
      const user = await harness.request<UserAccount>('/api/users', {
        method: 'POST', body: { name: `List ${suffix}`, email: `${suffix}@example.com`, role: 'member', password: 'Fixture-only-12345' },
      })
      expect(user.status).toBe(201)
      const bodies = [
        ['repositories', { name: `list-${suffix}`, provider: 'gitlab', externalId: suffix === 'owner-first' ? '102' : '101', url: `${harness.gitLabBaseUrl}/forgepilot/list-${suffix}.git` }],
        ['members', { userId: user.data.id, role: '开发' }],
        ['environments', { address: `https://${suffix}.example.com`, note: '列表测试', type: 'testing', accounts: [{ account: 'tester', password: '' }] }],
        ['knowledge', { title: `知识 ${suffix}`, content: '用于资产列表 API 验证的正文。' }],
      ] as const
      for (const [module, body] of bodies) {
        const response = await harness.request(`/api/projects/${id}/${module}`, { method: 'POST', body })
        expect(response.status, `${module}: ${JSON.stringify(response.data)}`).toBe(201)
      }
    }
    await addAssets(projectId, 'owner-first')
    await addAssets(projectId, 'owner-second')
    await addAssets(foreignProjectId, 'foreign-only')
    workspace = (await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)).data
    expect((await harness.request('/api/settings/gitlab', { method: 'PUT', body: { baseUrl: harness.gitLabBaseUrl, token: 'valid-token' } })).status).toBe(200)
  })
  afterAll(async () => { await harness?.stop() })

  test.each(modules)('returns complete typed %s arrays from only the current project', async (assetType, module) => {
    const requestCount = harness.gitLabRequests.length
    const response = await harness.request<Record<string, unknown>[]>(listPath(projectId, assetType), { method: 'POST', body: {} })
    expect(response.status).toBe(200)
    expect(response.data).toHaveLength(2)
    expect(response.data).toEqual(workspace[module])
    expect(response.data.every(asset => asset.projectId === projectId)).toBe(true)
    const operation = findAssetOperation(assetType, `${assetType}.list`)
    if (!isProjectAssetOperation(operation)) throw new Error('Missing contract')
    expect(() => assertWorkflowOperationOutput(operation.contract.output, response.data, operation.contract.outputType)).not.toThrow()
    for (const item of response.data) assertDeclaredKeys(operation.contract.output, item)
    expect(harness.gitLabRequests).toHaveLength(requestCount)
    const empty = await harness.request(listPath(emptyProjectId, assetType), { method: 'POST' })
    expect(empty).toMatchObject({ status: 200, data: [] })
  })

  test.each(modules)('returns stable %s errors for unknown projects, extra inputs, and single-asset use', async (assetType, module) => {
    const missing = await harness.request(listPath('missing-project', assetType), { method: 'POST' })
    expect(missing).toMatchObject({ status: 404, data: { data: { code: 'asset.project-not-found' } } })
    for (const body of [{ projectId: foreignProjectId }, { assetId: workspace[module][0]!.id }, null, [], 'invalid']) {
      const invalid = await harness.request(listPath(projectId, assetType), { method: 'POST', body })
      expect(invalid).toMatchObject({ status: 400, data: { data: { code: 'asset.invalid-input' } } })
    }
    const singleAsset = await harness.request(`/api/assets/${assetType}/${workspace[module][0]!.id}/operations/${assetType}.list`, { method: 'POST' })
    expect(singleAsset).toMatchObject({ status: 400, data: { data: { code: 'asset.invalid-input' } } })
  })

  test('rejects unsupported types and commands instead of interpreting an asset ID as a project', async () => {
    for (const [assetType, operationId] of [['unknown', 'unknown.list'], ['member', 'repository.list'], ['repository', 'repository.clone']]) {
      const response = await harness.request(listPath(projectId, assetType!, operationId), { method: 'POST' })
      expect(response).toMatchObject({ status: 404, data: { data: { code: 'asset.operation-not-found' } } })
    }
  })

  test('persists each asset type as an array in workflow history without requiring asset IDs', async () => {
    const workflow = await createWorkflow(projectId, modules.map(([type]) => listNode(type)))
    const run = await runWorkflow(workflow)
    expect(run.status).toBe('succeeded')
    for (const [index, [, module]] of modules.entries()) {
      expect(run.steps[index]?.output).toEqual(workspace[module])
      expect(run.steps[index]?.resolvedInputs).toEqual({})
      expect(run.workflow.nodes[index]).not.toHaveProperty('assetId')
    }
  })

  test('feeds the first repository ID into an existing asset command through $prev.0.id', async () => {
    const branch: WorkflowOperationNode = {
      id: 'create-branch', assetType: 'repository', operationId: 'repository.create-branch', assetSource: 'input',
      inputs: { repositoryId: '$prev.0.id', branch: 'feature/from-asset-list', source: 'main' }, position: { x: 200, y: 350 },
    }
    const workflow = await createWorkflow(projectId, [listNode('repository'), branch])
    const run = await runWorkflow(workflow)
    expect(run.status).toBe('succeeded')
    expect(run.steps[1]?.resolvedInputs?.repositoryId).toBe(workspace.repositories[0]?.id)
    expect(run.steps[1]?.output).toMatchObject({ repositoryId: workspace.repositories[0]?.id, branch: 'feature/from-asset-list' })
    const emptyWorkflow = await createWorkflow(emptyProjectId, [listNode('repository'), branch])
    const count = harness.gitLabRequests.length
    const emptyRun = await runWorkflow(emptyWorkflow)
    expect(emptyRun.steps[0]?.output).toEqual([])
    expect(emptyRun.steps[1]?.error?.code).toBe('workflow.input-reference-not-found')
    expect(harness.gitLabRequests).toHaveLength(count)
  })

  test('rejects fixed-asset bindings on project-wide nodes', async () => {
    const workflow = await createWorkflow(projectId, [listNode('repository')])
    const response = await harness.request(`/api/workflows/${workflow.id}`, {
      method: 'PATCH', body: { nodes: [{ ...listNode('repository'), assetSource: 'fixed', assetId: workspace.repositories[0]?.id }] },
    })
    expect(response).toMatchObject({ status: 400, data: { data: { code: 'asset.invalid-input' } } })
  })
})

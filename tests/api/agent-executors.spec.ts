import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { KnowledgeAsset, Project, RepositoryAsset, WorkflowDefinition } from '../../shared/types/asdp'
import type { AgentExecutionResult } from '../../shared/types/agent-executors'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'

let harness: ApiTestHarness
let root: string
let projectId: string
let otherKnowledge: KnowledgeAsset
let repository: RepositoryAsset
let repositoryPath: string
const input = { prompt: '请调研代码', writable: false, references: [] }
const operationPath = (executor = 'codex') => `/api/projects/${projectId}/assets/repository/operations/repository.agent-${executor}`

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'forgepilot-agent-api-'))
  harness = await startApiTestHarness({ env: {
    FORGEPILOT_CODEX_API_KEY: 'test-codex-key', FORGEPILOT_CLAUDE_API_KEY: 'test-claude-key',
    FORGEPILOT_AGENT_DOCKER_COMMAND: JSON.stringify([process.execPath, join(process.cwd(), 'tests', 'fixtures', 'agent-docker.mjs')]),
  } })
  const project = await harness.request<Project>('/api/projects', { method: 'POST', body: { name: '智能体节点测试', description: '' } })
  projectId = project.data.id
  const other = await harness.request<Project>('/api/projects', { method: 'POST', body: { name: '其他项目', description: '' } })
  otherKnowledge = (await harness.request<KnowledgeAsset>(`/api/projects/${other.data.id}/knowledge`, { method: 'POST', body: { title: '其他项目私有文档', content: '不可读取' } })).data
  const settings = await harness.request('/api/settings/workspace', { method: 'PUT', body: { path: root } })
  expect(settings.status).toBe(200)
  repository = (await harness.request<RepositoryAsset>(`/api/projects/${projectId}/repositories`, { method: 'POST', body: { name: 'example', provider: 'github', url: 'https://github.com/example/research.git' } })).data
  repositoryPath = join(root, 'projects', projectId, 'repositories', 'research')
  await mkdir(repositoryPath, { recursive: true })
  execFileSync('git', ['init', repositoryPath], { windowsHide: true })
  execFileSync('git', ['-C', repositoryPath, 'remote', 'add', 'origin', repository.url], { windowsHide: true })
  await writeFile(join(repositoryPath, 'index.ts'), 'export const value = 1\n')
  await writeFile(join(repositoryPath, '.env'), 'PROJECT_SECRET=never-share')
})
afterAll(async () => { await harness?.stop(); if (root) await rm(root, { recursive: true, force: true }) })

describe('agent operation API', () => {
  test.each(['codex', 'claude-code'])('runs %s with a normalized successful output', async executor => {
    const response = await harness.request<AgentExecutionResult>(operationPath(executor), { method: 'POST', body: input })
    expect(response.status).toBe(200)
    expect(response.data).toMatchObject({ executor, writable: false, text: expect.stringContaining('调研完成'), durationMs: expect.any(Number) })
    expect(JSON.stringify(response.data)).not.toMatch(/test-codex-key|test-claude-key/)
  })
  test('rejects malformed input and cross-project asset references with stable codes', async () => {
    const invalid = await harness.request(operationPath(), { method: 'POST', body: { ...input, writable: 'true' } })
    expect(invalid).toMatchObject({ status: 400, data: { data: { code: 'agent.invalid-input' } } })
    const foreign = await harness.request(operationPath(), { method: 'POST', body: { ...input, references: [{ assetType: 'knowledge', assetId: otherKnowledge.id }] } })
    expect(foreign).toMatchObject({ status: 404, data: { data: { code: 'agent.asset-unavailable' } } })
  })
  test.each([['failed', 'agent.execution-failed', 502], ['invalid', 'agent.output-invalid', 502], ['timeout', 'agent.timeout', 504], ['runner-missing', 'agent.runner-unavailable', 503]])('returns a stable %s failure', async (mode, code, status) => {
    const response = await harness.request(operationPath(), { method: 'POST', body: { ...input, prompt: `MODE:${mode}` } })
    expect(response).toMatchObject({ status, data: { data: { code } } })
  })
  test('isolates read-only runs and applies explicitly authorized successful code writes', async () => {
    const references = [{ assetType: 'repository', assetId: repository.id }]
    const before = await harness.request(operationPath(), { method: 'POST', body: { ...input, prompt: 'MODE:write', references } })
    expect(before.status).toBe(200)
    expect(await readdir(repositoryPath)).not.toContain('agent-result.ts')
    const after = await harness.request(operationPath('claude-code'), { method: 'POST', body: { ...input, prompt: 'MODE:write', writable: true, references } })
    expect(after.status).toBe(200)
    expect(await readFile(join(repositoryPath, 'agent-result.ts'), 'utf8')).toContain('added = true')
    expect(await readFile(join(repositoryPath, '.env'), 'utf8')).toBe('PROJECT_SECRET=never-share')
    expect(await readdir(join(root, 'projects', projectId, 'agent-runs'))).toEqual([])
  })
  test('persists both agent nodes and automatically passes their output through the workflow', async () => {
    const workflow = (await harness.request<WorkflowDefinition>(`/api/projects/${projectId}/workflows`, { method: 'POST', body: { name: '智能体串联', note: '' } })).data
    const nodes = ['codex', 'claude-code'].map((executor, index) => ({
      id: executor, assetType: 'repository', assetSource: 'input', operationId: `repository.agent-${executor}`,
      inputs: { ...input, prompt: index === 0 ? '$root.question' : '整理上游结论' }, position: { x: 200, y: 200 + index * 180 },
    }))
    const saved = await harness.request(`/api/workflows/${workflow.id}`, { method: 'PATCH', body: {
      trigger: { kind: 'manual', position: { x: 200, y: 0 } }, nodes,
      edges: [{ id: 'start', source: 'workflow-trigger', target: 'codex' }, { id: 'next', source: 'codex', target: 'claude-code' }],
    } })
    expect(saved.status).toBe(200)
    const started = await harness.request<WorkflowRun>(`/api/workflows/${workflow.id}/runs`, { method: 'POST', body: { root: { question: '查阅调用链' } } })
    expect(started.status).toBe(202)
    let run: WorkflowRun
    await expect.poll(async () => {
      run = (await harness.request<WorkflowRun[]>(`/api/workflows/${workflow.id}/runs`)).data.find(item => item.id === started.data.id)!
      return run?.status
    }, { timeout: 5000 }).toBe('succeeded')
    expect(run!.steps[1]?.resolvedInputs?.upstream).toBe(JSON.stringify(run!.steps[0]?.output))
    expect(run!.output).toMatchObject({ executor: 'claude-code', text: expect.stringContaining('查阅调用链') })
  })
})

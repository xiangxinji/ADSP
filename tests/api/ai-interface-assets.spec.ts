import { createDecipheriv, createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import initSqlJs from 'sql.js'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { AiInterfaceAsset } from '../../shared/types/ai-interfaces'
import type { KnowledgeAsset, Project, ProjectSummary, ProjectWorkspace } from '../../shared/types/asdp'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'

let harness: ApiTestHarness
let projectId: string
let otherProjectId: string
let asset: AiInterfaceAsset
const apiKey = 'test-only-ai-interface-secret'
const payload = { provider: 'DeepSeek', name: '需求分析', apiKey }
const listPath = () => `/api/projects/${projectId}/ai-interfaces`
const assetPath = () => `/api/ai-interfaces/${asset.id}`
const SQL = await initSqlJs()

const storedKey = async () => {
  const database = new SQL.Database(await readFile(harness.databasePath))
  try {
    return database.exec('SELECT encrypted_api_key FROM ai_interface_assets WHERE id = ?', [asset.id])[0]!.values[0]![0] as string
  } finally {
    database.close()
  }
}

const decryptTestKey = (encrypted: string) => {
  const [version, iv, tag, ciphertext] = encrypted.split(':')
  expect(version).toBe('v1')
  const key = createHash('sha256').update(process.env.FORGEPILOT_CREDENTIAL_ENCRYPTION_KEY || 'asdp-api-test-key').digest()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv!, 'base64'))
  decipher.setAuthTag(Buffer.from(tag!, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext!, 'base64')), decipher.final()]).toString('utf8')
}

const expectPublic = (value: unknown) => {
  const serialized = JSON.stringify(value)
  expect(serialized).not.toContain(apiKey)
  expect(serialized).not.toContain('encryptedApiKey')
  expect(serialized).not.toContain('encrypted_api_key')
  expect(serialized).not.toContain('"apiKey"')
}

beforeAll(async () => {
  harness = await startApiTestHarness()
  const project = await harness.request<Project>('/api/projects', { method: 'POST', body: { name: 'AI 接口测试', description: '' } })
  const other = await harness.request<Project>('/api/projects', { method: 'POST', body: { name: '隔离项目', description: '' } })
  projectId = project.data.id
  otherProjectId = other.data.id
})

afterAll(async () => { await harness?.stop() })

describe('project AI interface assets API', () => {
  test('starts with an empty collection, creates an asset and encrypts its key at rest', async () => {
    expect(await harness.request(listPath())).toMatchObject({ status: 200, data: [] })
    const response = await harness.request<AiInterfaceAsset>(listPath(), { method: 'POST', body: payload })
    expect(response.status).toBe(201)
    asset = response.data
    expect(asset).toEqual({
      id: expect.any(String), projectId, provider: 'DeepSeek', name: '需求分析', hasApiKey: true,
      createdAt: expect.any(String), updatedAt: expect.any(String),
    })
    expectPublic(asset)
    const encrypted = await storedKey()
    expect(encrypted).not.toContain(apiKey)
    expect(decryptTestKey(encrypted)).toBe(apiKey)
    expect((await readFile(harness.databasePath)).includes(Buffer.from(apiKey))).toBe(false)
  })

  test('returns safe metadata in lists, workspace and summaries, scoped to the project', async () => {
    expect(await harness.request(listPath())).toMatchObject({ status: 200, data: [asset] })
    const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
    expect(workspace.data.aiInterfaces).toEqual([asset])
    expectPublic(workspace.data)
    expect(await harness.request(`/api/projects/${otherProjectId}/ai-interfaces`)).toMatchObject({ status: 200, data: [] })
    const summary = await harness.request<ProjectSummary[]>('/api/projects')
    expect(summary.data.find(project => project.id === projectId)?.aiInterfaceCount).toBe(1)
    expect(summary.data.find(project => project.id === otherProjectId)?.aiInterfaceCount).toBe(0)
  })

  test('allows custom providers and duplicate names only in different projects', async () => {
    const other = await harness.request<AiInterfaceAsset>(`/api/projects/${otherProjectId}/ai-interfaces`, {
      method: 'POST', body: { ...payload, provider: '自定义平台' },
    })
    expect(other).toMatchObject({ status: 201, data: { provider: '自定义平台' } })
    const duplicate = await harness.request(listPath(), { method: 'POST', body: { ...payload, provider: 'OpenAI' } })
    expect(duplicate.status).toBe(409)
    expectPublic(duplicate.data)
  })

  test('preserves an omitted key, replaces an explicit key, and never returns either key', async () => {
    const initial = await storedKey()
    const renamed = await harness.request<AiInterfaceAsset>(assetPath(), { method: 'PATCH', body: { name: '新版需求分析', provider: '自建平台' } })
    expect(renamed).toMatchObject({ status: 200, data: { name: '新版需求分析', provider: '自建平台', hasApiKey: true } })
    expect(await storedKey()).toBe(initial)
    expectPublic(renamed.data)
    const replacement = 'test-only-replacement-key'
    const rotated = await harness.request<AiInterfaceAsset>(assetPath(), { method: 'PATCH', body: { apiKey: replacement } })
    expect(rotated.status).toBe(200)
    expectPublic(rotated.data)
    expect(JSON.stringify(rotated.data)).not.toContain(replacement)
    expect(decryptTestKey(await storedKey())).toBe(replacement)
    asset = rotated.data
  })

  test('rejects invalid input, project reassignment and duplicate updates without changing the key', async () => {
    const initial = await storedKey()
    for (const body of [null, [], {}, { ...payload, apiKey: '' }, { ...payload, provider: 42 }, { ...payload, name: 'a'.repeat(101) }]) {
      const response = await harness.request(listPath(), { method: 'POST', body })
      expect(response.status).toBe(400)
      expectPublic(response.data)
    }
    for (const body of [{ apiKey: '' }, { apiKey: null }, { apiKey: 'key\nvalue' }, { projectId: otherProjectId }]) {
      const response = await harness.request(assetPath(), { method: 'PATCH', body })
      expect(response.status).toBe(400)
      expectPublic(response.data)
    }
    const duplicate = await harness.request<AiInterfaceAsset>(listPath(), { method: 'POST', body: { ...payload, name: 'Reserved' } })
    const conflict = await harness.request(assetPath(), { method: 'PATCH', body: { name: 'reserved', apiKey: 'test-only-rejected-key' } })
    expect(conflict.status).toBe(409)
    expect(await storedKey()).toBe(initial)
    await harness.request(`/api/ai-interfaces/${duplicate.data.id}`, { method: 'DELETE' })
  })

  test('reports missing projects and assets and does not expose configuration as a workflow command', async () => {
    expect((await harness.request('/api/projects/missing/ai-interfaces')).status).toBe(404)
    expect((await harness.request('/api/projects/missing/ai-interfaces', { method: 'POST', body: payload })).status).toBe(404)
    expect((await harness.request('/api/ai-interfaces/missing', { method: 'PATCH', body: { name: '新名称' } })).status).toBe(404)
    expect((await harness.request('/api/ai-interfaces/missing', { method: 'DELETE' })).status).toBe(404)
    const operation = await harness.request(`/api/assets/ai-interface/${asset.id}/operations/ai-interface.edit`, { method: 'POST' })
    expect(operation.status).toBe(404)
  })

  test('retains encrypted credentials across a restart', async () => {
    const snapshot = await readFile(harness.databasePath)
    const restarted = await startApiTestHarness({ prepareDatabase: databasePath => writeFile(databasePath, snapshot) })
    try {
      expect(await restarted.request(listPath())).toMatchObject({ status: 200, data: [asset] })
      expectPublic((await restarted.request(`/api/projects/${projectId}`)).data)
    } finally {
      await restarted.stop()
    }
  })

  test('upgrades a database without the new asset table without rewriting existing projects', async () => {
    const database = new SQL.Database(await readFile(harness.databasePath))
    database.run('DROP TABLE ai_interface_assets')
    const snapshot = database.export()
    database.close()
    const upgraded = await startApiTestHarness({ prepareDatabase: databasePath => writeFile(databasePath, snapshot) })
    try {
      const workspace = await upgraded.request<ProjectWorkspace>(`/api/projects/${projectId}`)
      expect(workspace).toMatchObject({ status: 200, data: { project: { id: projectId }, aiInterfaces: [] } })
    } finally {
      await upgraded.stop()
    }
  })

  test('resolves project-local Markdown references and preserves unresolved tokens after deletion', async () => {
    const content = `[[ai-interface:${asset.id}]] [[AI 接口：${asset.id}]]`
    const knowledge = await harness.request<KnowledgeAsset>(`/api/projects/${projectId}/knowledge`, { method: 'POST', body: { title: 'AI 引用', content } })
    expect(knowledge.data.references).toEqual([expect.objectContaining({ targetType: 'ai-interface', recordId: asset.id, label: asset.name, resolved: true })])
    const foreign = await harness.request<KnowledgeAsset>(`/api/projects/${otherProjectId}/knowledge`, { method: 'POST', body: { title: '跨项目引用', content } })
    expect(foreign.data.references[0]).toMatchObject({ label: null, resolved: false })
    expect((await harness.request(assetPath(), { method: 'DELETE' })).status).toBe(204)
    const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${projectId}`)
    expect(workspace.data.aiInterfaces).toEqual([])
    expect(workspace.data.knowledge[0]).toMatchObject({ content, references: [expect.objectContaining({ resolved: false, label: null })] })
    expectPublic(workspace.data)
    expect((await harness.request(assetPath(), { method: 'DELETE' })).status).toBe(404)
  })

  test('deleting a project cascades to its AI interfaces', async () => {
    const created = await harness.request<AiInterfaceAsset>(listPath(), { method: 'POST', body: payload })
    expect((await harness.request(`/api/projects/${projectId}`, { method: 'DELETE' })).status).toBe(204)
    expect((await harness.request(`/api/ai-interfaces/${created.data.id}`, { method: 'PATCH', body: { name: 'deleted' } })).status).toBe(404)
    expect((await harness.request<AiInterfaceAsset[]>(`/api/projects/${otherProjectId}/ai-interfaces`)).data).toHaveLength(1)
  })
})

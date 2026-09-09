import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { Project, WorkflowDefinition } from '../../shared/types/asdp'
import { startApiTestHarness, type ApiTestHarness } from '../support/api-test-harness'
import { asyncNode, listNode, workflowEdge as edge } from '../support/workflow-fixtures'

let harness: ApiTestHarness
let projectId: string
const listPage = () => fetch(harness.baseUrl + '/projects/' + projectId + '/workflows')
const createWorkflow = async (name: string) => {
  const response = await harness.request<WorkflowDefinition>('/api/projects/' + projectId + '/workflows', {
    method: 'POST', body: { name, note: '' },
  })
  expect(response.status).toBe(201)
  return response.data
}

describe('workflow list server rendering', () => {
  beforeAll(async () => {
    harness = await startApiTestHarness()
    const project = await harness.request<Project>('/api/projects', {
      method: 'POST', body: { name: '工作流列表回归', description: '' },
    })
    expect(project.status).toBe(201)
    projectId = project.data.id
  })
  afterAll(async () => { await harness?.stop() })

  test('renders unconfigured drafts without graph errors', async () => {
    await createWorkflow('未配置工作流')
    const response = await listPage()
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('草稿')
  })

  test.each(['operation', 'sync', 'async'] as const)('renders configured %s workflows using complete node objects', async kind => {
    const workflow = await createWorkflow('已配置-' + kind)
    const nodes = kind === 'operation' ? [listNode()]
      : [listNode(), { ...asyncNode(), kind }, listNode('child')]
    const edges = [edge('workflow-trigger', 'items'), ...(kind === 'operation' ? []
      : [edge('items', 'parallel'), edge('parallel', 'child', 'item')])]
    const saved = await harness.request('/api/workflows/' + workflow.id, {
      method: 'PATCH', body: { trigger: { kind: 'manual', position: { x: 0, y: 0 } }, nodes, edges },
    })
    expect(saved.status).toBe(200)
    const response = await listPage()
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain(workflow.name)
    expect(html).toContain('class="configured"')
    expect(html).not.toContain('Cannot read properties of undefined')
  })
})

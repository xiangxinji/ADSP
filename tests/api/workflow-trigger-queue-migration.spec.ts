import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { describe, expect, test } from 'vitest'
import type { Requirement, WorkflowDefinition } from '../../shared/types/asdp'
import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { startApiTestHarness } from '../support/api-test-harness'

const projectId = 'legacy-trigger-project'
const workflowId = 'legacy-trigger-workflow'

const prepareLegacyDatabase = async (databasePath: string) => {
  const SQL = await initSqlJs({ locateFile: () => resolve('node_modules', 'sql.js', 'dist', 'sql-wasm.wasm') })
  const database = new SQL.Database()
  const timestamp = new Date().toISOString()
  const workflow: WorkflowDefinition = {
    id: workflowId,
    projectId,
    name: '旧工作流运行',
    note: '',
    trigger: { kind: 'manual', position: { x: 100, y: 0 } },
    nodes: [],
    edges: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  database.run(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE workflow_definitions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      trigger_kind TEXT,
      trigger_x REAL,
      trigger_y REAL,
      nodes_json TEXT NOT NULL DEFAULT '[]',
      edges_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      definition_json TEXT NOT NULL,
      status TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT
    );
  `)
  database.run(
    'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [projectId, '旧触发项目', '', timestamp, timestamp],
  )
  database.run(`
    INSERT INTO workflow_definitions
      (id, project_id, name, note, trigger_kind, trigger_x, trigger_y, nodes_json, edges_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [workflowId, projectId, workflow.name, '', 'manual', 100, 0, '[]', '[]', timestamp, timestamp])
  database.run(`
    INSERT INTO workflow_runs
      (id, workflow_id, project_id, definition_json, status, steps_json, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, ['legacy-run', workflowId, projectId, JSON.stringify(workflow), 'succeeded', JSON.stringify({ root: {}, steps: [] }), timestamp, timestamp])
  await writeFile(databasePath, Buffer.from(database.export()))
  database.close()
}

describe('workflow trigger queue database migration', () => {
  test('preserves legacy runs and supports idempotent event runs', async () => {
    const harness = await startApiTestHarness({ prepareDatabase: prepareLegacyDatabase })
    try {
      const configured = await harness.request<WorkflowDefinition>(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        body: {
          trigger: { kind: 'requirement-created', position: { x: 100, y: 0 } },
          nodes: [{
            id: 'list-assets', assetType: 'repository', assetSource: 'input', operationId: 'repository.list',
            inputs: {}, position: { x: 100, y: 180 },
          }],
          edges: [{ id: 'root-list', source: 'workflow-trigger', target: 'list-assets' }],
        },
      })
      expect(configured.status).toBe(200)
      const requirement = await harness.request<Requirement>(`/api/projects/${projectId}/requirements`, {
        method: 'POST',
        body: {
          title: '迁移后的需求事件', description: '', acceptanceCriteria: '', priority: 'medium',
          versionIds: [], repositoryIds: [], memberIds: [],
        },
      })
      expect(requirement.status).toBe(201)

      await expect.poll(async () => {
        const history = await harness.request<WorkflowRun[]>(`/api/workflows/${workflowId}/runs`)
        return history.data.length
      }).toBe(2)
      const history = await harness.request<WorkflowRun[]>(`/api/workflows/${workflowId}/runs`)
      expect(history.data[0]).toMatchObject({
        status: 'succeeded', triggerEventId: expect.any(String), root: { id: requirement.data.id },
      })
      expect(history.data[1]).toMatchObject({ id: 'legacy-run', status: 'succeeded' })
      expect(history.data[1]).not.toHaveProperty('triggerEventId')
    } finally {
      await harness.stop()
    }
  })
})

import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { describe, expect, test } from 'vitest'
import type { ProjectWorkspace } from '../../shared/types/asdp'
import { workflowTriggerNodeId } from '../../shared/utils/workflow-graph'
import { startApiTestHarness } from '../support/api-test-harness'

const legacyProjectId = 'legacy-workflow-project'

const prepareLegacyDatabase = async (databasePath: string) => {
  const SQL = await initSqlJs({ locateFile: () => resolve('node_modules', 'sql.js', 'dist', 'sql-wasm.wasm') })
  const database = new SQL.Database()
  const timestamp = new Date().toISOString()
  const nodes = [
    {
      id: 'legacy-node-a',
      assetType: 'repository',
      assetId: 'repository-a',
      operationId: 'repository.clone',
      inputs: { repositoryId: 'repository-a' },
      position: { x: 200, y: 240 },
    },
    {
      id: 'legacy-node-b',
      assetType: 'repository',
      assetId: 'repository-a',
      operationId: 'repository.update',
      inputs: { repositoryId: 'repository-a' },
      position: { x: 200, y: 420 },
    },
  ]
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  database.run(
    'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [legacyProjectId, '旧工作流项目', '', timestamp, timestamp],
  )
  database.run(`
    INSERT INTO workflow_definitions
      (id, project_id, name, note, trigger_kind, trigger_x, trigger_y, nodes_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['legacy-workflow', legacyProjectId, '旧线性工作流', '', 'manual', 200, 80, JSON.stringify(nodes), timestamp, timestamp])
  await writeFile(databasePath, Buffer.from(database.export()))
  database.close()
}

describe('workflow edge database migration', () => {
  test('infers persisted connections for legacy ordered nodes', async () => {
    const harness = await startApiTestHarness({ prepareDatabase: prepareLegacyDatabase })
    try {
      const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${legacyProjectId}`)
      expect(workspace.status).toBe(200)
      expect(workspace.data.workflows[0].edges).toEqual([
        { id: 'workflow-edge-legacy-0', source: workflowTriggerNodeId, target: 'legacy-node-a' },
        { id: 'workflow-edge-legacy-1', source: 'legacy-node-a', target: 'legacy-node-b' },
      ])
    } finally {
      await harness.stop()
    }
  })
})

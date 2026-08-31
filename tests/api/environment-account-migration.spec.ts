import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { describe, expect, test } from 'vitest'
import type { EnvironmentAsset, ProjectWorkspace } from '../../shared/types/asdp'
import { startApiTestHarness } from '../support/api-test-harness'

const legacyProjectId = 'legacy-environment-project'
const legacyEnvironmentId = 'legacy-environment'

const prepareLegacyDatabase = async (databasePath: string) => {
  const SQL = await initSqlJs({
    locateFile: () => resolve('node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  })
  const database = new SQL.Database()
  const timestamp = new Date().toISOString()
  database.run(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE environment_assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      address TEXT NOT NULL,
      environment_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, address)
    );
    CREATE TABLE environment_accounts (
      environment_id TEXT NOT NULL REFERENCES environment_assets(id) ON DELETE CASCADE,
      account TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(environment_id, account)
    );
  `)
  database.run(
    'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [legacyProjectId, '旧环境项目', '', timestamp, timestamp],
  )
  database.run(
    'INSERT INTO environment_assets (id, project_id, address, environment_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [legacyEnvironmentId, legacyProjectId, 'https://legacy.example.com', 'testing', timestamp, timestamp],
  )
  database.run(
    'INSERT INTO environment_accounts (environment_id, account, sort_order) VALUES (?, ?, ?)',
    [legacyEnvironmentId, 'legacy-user', 0],
  )
  await writeFile(databasePath, Buffer.from(database.export()))
  database.close()
}

describe('environment account database migration', () => {
  test('adds empty passwords to existing accounts and accepts a clear-text password update', async () => {
    const harness = await startApiTestHarness({ prepareDatabase: prepareLegacyDatabase })
    try {
      const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${legacyProjectId}`)
      expect(workspace.status).toBe(200)
      expect(workspace.data.environments).toEqual([
        expect.objectContaining({
          id: legacyEnvironmentId,
          accounts: [{ account: 'legacy-user', password: '' }],
        }),
      ])

      const updated = await harness.request<EnvironmentAsset>(`/api/environments/${legacyEnvironmentId}`, {
        method: 'PATCH',
        body: { accounts: [{ account: 'legacy-user', password: 'visible-password' }] },
      })
      expect(updated.status).toBe(200)
      expect(updated.data.accounts).toEqual([{ account: 'legacy-user', password: 'visible-password' }])
    } finally {
      await harness.stop()
    }
  })
})

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { describe, expect, test } from 'vitest'
import type { ProjectWorkspace, RepositoryAsset } from '../../shared/types/asdp'
import { startApiTestHarness } from '../support/api-test-harness'

const legacyProjectId = 'legacy-repository-project'
const legacyRepositoryId = 'legacy-repository'

const sqlJs = () => initSqlJs({
  locateFile: () => resolve('node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
})

const prepareLegacyDatabase = async (databasePath: string) => {
  const SQL = await sqlJs()
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
    CREATE TABLE repository_assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'gitlab',
      external_id TEXT,
      name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      default_branch TEXT NOT NULL DEFAULT 'main',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, url)
    );
  `)
  database.run(
    'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [legacyProjectId, '旧仓库项目', '', timestamp, timestamp],
  )
  database.run(
    `INSERT INTO repository_assets
      (id, project_id, provider, external_id, name, note, url, default_branch, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      legacyRepositoryId,
      legacyProjectId,
      'gitlab',
      '101',
      'legacy-repository',
      '',
      'https://gitlab.example.com/forgepilot/legacy-repository.git',
      'master',
      timestamp,
      timestamp,
    ],
  )
  await writeFile(databasePath, Buffer.from(database.export()))
  database.close()
}

describe('repository asset default branch migration', () => {
  test('removes persisted default branches and accepts branch-free assets', async () => {
    const harness = await startApiTestHarness({ prepareDatabase: prepareLegacyDatabase })
    try {
      const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${legacyProjectId}`)
      expect(workspace.status).toBe(200)
      expect(workspace.data.repositories).toEqual([
        expect.objectContaining({ id: legacyRepositoryId, name: 'legacy-repository' }),
      ])
      expect(workspace.data.repositories[0]).not.toHaveProperty('defaultBranch')

      const created = await harness.request<RepositoryAsset>(`/api/projects/${legacyProjectId}/repositories`, {
        method: 'POST',
        body: {
          provider: 'github',
          name: 'branch-free-repository',
          url: 'https://github.com/forgepilot/branch-free-repository.git',
        },
      })
      expect(created.status).toBe(201)
      expect(created.data).not.toHaveProperty('defaultBranch')

      const SQL = await sqlJs()
      const database = new SQL.Database(await readFile(harness.databasePath))
      const columns = database.exec('PRAGMA table_info(repository_assets)')[0].values
        .map(column => String(column[1]))
      expect(columns).not.toContain('default_branch')
      database.close()
    } finally {
      await harness.stop()
    }
  })
})

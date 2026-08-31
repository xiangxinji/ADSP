import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { describe, expect, test } from 'vitest'
import type { ProjectWorkspace, RequirementVersion } from '../../shared/types/asdp'
import { startApiTestHarness } from '../support/api-test-harness'

const legacyProjectId = 'legacy-version-project'

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
    CREATE TABLE requirement_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL COLLATE NOCASE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, name)
    );
  `)
  database.run(
    'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [legacyProjectId, '旧版本项目', '', timestamp, timestamp],
  )
  database.run(
    'INSERT INTO requirement_versions (id, project_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ['legacy-version-7', legacyProjectId, 'v7.x', timestamp, timestamp],
  )
  await writeFile(databasePath, Buffer.from(database.export()))
  database.close()
}

describe('requirement version database migration', () => {
  test('migrates name-based rows and accepts new major versions', async () => {
    const harness = await startApiTestHarness({ prepareDatabase: prepareLegacyDatabase })
    try {
      const workspace = await harness.request<ProjectWorkspace>(`/api/projects/${legacyProjectId}`)
      expect(workspace.status).toBe(200)
      expect(workspace.data.requirementVersions).toEqual([
        expect.objectContaining({ id: 'legacy-version-7', major: 7, name: 'v7.x', isLatest: true }),
      ])

      const created = await harness.request<RequirementVersion>(`/api/projects/${legacyProjectId}/requirement-versions`, {
        method: 'POST',
        body: { major: 8 },
      })
      expect(created.status).toBe(201)
      expect(created.data).toMatchObject({ major: 8, name: 'v8.x', isLatest: true })
    } finally {
      await harness.stop()
    }
  })
})

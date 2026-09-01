import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { describe, expect, test } from 'vitest'
import type { ManagedUserAccount } from '../../shared/types/asdp'
import { startApiTestHarness } from '../support/api-test-harness'

const legacyUserId = 'legacy-user'

const sqlJsOptions = {
  locateFile: () => resolve('node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
}

const prepareLegacyDatabase = async (databasePath: string) => {
  const SQL = await initSqlJs(sqlJsOptions)
  const database = new SQL.Database()
  const timestamp = new Date().toISOString()
  database.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  database.run(
    'INSERT INTO users (id, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [legacyUserId, '历史用户', 'legacy@example.com', 'member', timestamp, timestamp],
  )
  await writeFile(databasePath, Buffer.from(database.export()))
  database.close()
}

describe('user password database migration', () => {
  test('keeps legacy users passwordless and stores only a hash after provisioning', async () => {
    const harness = await startApiTestHarness({ prepareDatabase: prepareLegacyDatabase })
    try {
      const users = await harness.request<ManagedUserAccount[]>('/api/users')
      expect(users.status).toBe(200)
      expect(users.data).toContainEqual(expect.objectContaining({ id: legacyUserId, hasPassword: false }))

      const updated = await harness.request<ManagedUserAccount>(`/api/users/${legacyUserId}/password`, {
        method: 'PUT',
        body: { password: 'provisioned-password' },
      })
      expect(updated.status).toBe(200)
      expect(updated.data).toMatchObject({ id: legacyUserId, hasPassword: true })

      const SQL = await initSqlJs(sqlJsOptions)
      const database = new SQL.Database(await readFile(harness.databasePath))
      const result = database.exec("SELECT password_hash FROM users WHERE id = 'legacy-user'")
      const passwordHash = String(result[0]?.values[0]?.[0] || '')
      expect(passwordHash).toMatch(/^scrypt\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/)
      expect(passwordHash).not.toContain('provisioned-password')
      database.close()
    } finally {
      await harness.stop()
    }
  })
})

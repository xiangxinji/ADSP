import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { defaultRequirementStatuses } from '../domain/requirement-statuses'

type PreparedQuery = {
  get: (...parameters: SqlValue[]) => Record<string, unknown> | undefined
  all: (...parameters: SqlValue[]) => Record<string, unknown>[]
  run: (...parameters: SqlValue[]) => void
}

class PersistentDatabase {
  private transactionDepth = 0

  constructor(
    private readonly database: SqlJsDatabase,
    private readonly databasePath: string,
  ) {}

  exec(sql: string) {
    this.database.run(sql)
    this.persistWhenReady()
  }

  pragma(pragma: string) {
    this.database.run(`PRAGMA ${pragma}`)
  }

  prepare(sql: string): PreparedQuery {
    return {
      get: (...parameters) => {
        const statement = this.database.prepare(sql)
        try {
          statement.bind(parameters)
          return statement.step() ? statement.getAsObject() : undefined
        } finally {
          statement.free()
        }
      },
      all: (...parameters) => {
        const statement = this.database.prepare(sql)
        const rows: Record<string, unknown>[] = []
        try {
          statement.bind(parameters)
          while (statement.step()) rows.push(statement.getAsObject())
          return rows
        } finally {
          statement.free()
        }
      },
      run: (...parameters) => {
        this.database.run(sql, parameters)
        this.persistWhenReady()
      },
    }
  }

  transaction<T>(callback: () => T) {
    return () => {
      this.database.run('BEGIN')
      this.transactionDepth += 1
      try {
        const result = callback()
        this.database.run('COMMIT')
        this.transactionDepth -= 1
        this.persist()
        return result
      } catch (error) {
        this.database.run('ROLLBACK')
        this.transactionDepth -= 1
        throw error
      }
    }
  }

  persist() {
    writeFileSync(this.databasePath, Buffer.from(this.database.export()))
  }

  private persistWhenReady() {
    if (this.transactionDepth === 0) this.persist()
  }
}

type DatabaseHolder = typeof globalThis & {
  __asdpDatabasePromise?: Promise<PersistentDatabase>
}

const globalDatabase = globalThis as DatabaseHolder

const createDatabase = async () => {
  const databasePath = process.env.FORGEPILOT_DB_PATH
    || process.env.ASDP_DB_PATH
    || resolve(process.cwd(), '.data', 'asdp.sqlite')
  const wasmPath = resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
  mkdirSync(dirname(databasePath), { recursive: true })

  const SQL = await initSqlJs({ locateFile: () => wasmPath })
  const existingData = existsSync(databasePath) ? readFileSync(databasePath) : undefined
  const database = new SQL.Database(existingData)
  const persistentDatabase = new PersistentDatabase(database, databasePath)
  persistentDatabase.pragma('foreign_keys = ON')

  persistentDatabase.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS repository_assets (
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

    CREATE TABLE IF NOT EXISTS environment_assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      address TEXT NOT NULL,
      environment_type TEXT NOT NULL CHECK(environment_type IN ('development', 'testing', 'production')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, address)
    );

    CREATE TABLE IF NOT EXISTS environment_accounts (
      environment_id TEXT NOT NULL REFERENCES environment_assets(id) ON DELETE CASCADE,
      account TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(environment_id, account)
    );

    CREATE TABLE IF NOT EXISTS knowledge_assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integration_settings (
      provider TEXT PRIMARY KEY,
      base_url TEXT NOT NULL,
      encrypted_token TEXT NOT NULL,
      token_hint TEXT NOT NULL,
      connected_user_id INTEGER,
      connected_user_name TEXT,
      connected_username TEXT,
      verified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, email)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS requirement_statuses (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#667085',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_initial INTEGER NOT NULL DEFAULT 0 CHECK(is_initial IN (0, 1)),
      is_terminal INTEGER NOT NULL DEFAULT 0 CHECK(is_terminal IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, key)
    );

    CREATE TABLE IF NOT EXISTS requirement_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      major INTEGER NOT NULL CHECK(major >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, major)
    );

    CREATE TABLE IF NOT EXISTS requirements (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      acceptance_criteria TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      priority TEXT NOT NULL DEFAULT 'medium',
      version_ids TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requirement_repositories (
      requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
      repository_id TEXT NOT NULL REFERENCES repository_assets(id) ON DELETE CASCADE,
      PRIMARY KEY(requirement_id, repository_id)
    );

    CREATE TABLE IF NOT EXISTS requirement_people (
      requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      PRIMARY KEY(requirement_id, person_id)
    );

    CREATE TABLE IF NOT EXISTS requirement_members (
      requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES project_members(id) ON DELETE CASCADE,
      PRIMARY KEY(requirement_id, member_id)
    );

    CREATE INDEX IF NOT EXISTS idx_requirements_project ON requirements(project_id);
    CREATE INDEX IF NOT EXISTS idx_repositories_project ON repository_assets(project_id);
    CREATE INDEX IF NOT EXISTS idx_environments_project ON environment_assets(project_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_assets(project_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_people_project ON people(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_updated ON users(updated_at);
    CREATE INDEX IF NOT EXISTS idx_requirement_statuses_project ON requirement_statuses(project_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_requirement_versions_project ON requirement_versions(project_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_requirement_statuses_initial
      ON requirement_statuses(project_id) WHERE is_initial = 1;
  `)

  const legacyPersonCount = persistentDatabase.prepare('SELECT COUNT(*) AS count FROM people').get() as { count: number }
  if (Number(legacyPersonCount.count) > 0) {
    persistentDatabase.transaction(() => {
      persistentDatabase.prepare(`
        INSERT OR IGNORE INTO users (id, name, email, role, created_at, updated_at)
          SELECT id, name, LOWER(email), 'member', created_at, updated_at
          FROM people ORDER BY created_at
      `).run()
      persistentDatabase.prepare(`
        INSERT OR IGNORE INTO project_members (id, project_id, user_id, role, created_at, updated_at)
          SELECT p.id, p.project_id, u.id, p.role, p.created_at, p.updated_at
          FROM people p JOIN users u ON u.email = p.email COLLATE NOCASE
      `).run()
      persistentDatabase.prepare(`
        INSERT OR IGNORE INTO requirement_members (requirement_id, member_id)
          SELECT rp.requirement_id, m.id
          FROM requirement_people rp
          JOIN people p ON p.id = rp.person_id
          JOIN users u ON u.email = p.email COLLATE NOCASE
          JOIN project_members m ON m.project_id = p.project_id AND m.user_id = u.id
      `).run()

      const missingMembers = persistentDatabase.prepare(`
        SELECT COUNT(*) AS count
        FROM people p
        LEFT JOIN users u ON u.email = p.email COLLATE NOCASE
        LEFT JOIN project_members m ON m.project_id = p.project_id AND m.user_id = u.id
        WHERE m.id IS NULL
      `).get() as { count: number }
      const missingReferences = persistentDatabase.prepare(`
        SELECT COUNT(*) AS count
        FROM requirement_people rp
        JOIN people p ON p.id = rp.person_id
        JOIN users u ON u.email = p.email COLLATE NOCASE
        JOIN project_members m ON m.project_id = p.project_id AND m.user_id = u.id
        LEFT JOIN requirement_members rm ON rm.requirement_id = rp.requirement_id AND rm.member_id = m.id
        WHERE rm.member_id IS NULL
      `).get() as { count: number }
      if (Number(missingMembers.count) > 0 || Number(missingReferences.count) > 0) {
        throw new Error('Legacy project people migration did not preserve every record')
      }

      persistentDatabase.prepare('DELETE FROM requirement_people').run()
      persistentDatabase.prepare('DELETE FROM people').run()
    })()
  }

  const repositoryColumns = persistentDatabase.prepare('PRAGMA table_info(repository_assets)').all() as { name: string }[]
  if (!repositoryColumns.some(column => column.name === 'provider')) {
    persistentDatabase.exec("ALTER TABLE repository_assets ADD COLUMN provider TEXT NOT NULL DEFAULT 'gitlab'")
  }
  if (!repositoryColumns.some(column => column.name === 'external_id')) {
    persistentDatabase.exec('ALTER TABLE repository_assets ADD COLUMN external_id TEXT')
  }
  if (!repositoryColumns.some(column => column.name === 'note')) {
    persistentDatabase.exec("ALTER TABLE repository_assets ADD COLUMN note TEXT NOT NULL DEFAULT ''")
  }
  persistentDatabase.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_repositories_external
      ON repository_assets(project_id, provider, external_id) WHERE external_id IS NOT NULL
  `)

  const requirementColumns = persistentDatabase.prepare('PRAGMA table_info(requirements)').all() as { name: string }[]
  if (!requirementColumns.some(column => column.name === 'status_id')) {
    persistentDatabase.exec('ALTER TABLE requirements ADD COLUMN status_id TEXT REFERENCES requirement_statuses(id) ON DELETE RESTRICT')
  }
  if (!requirementColumns.some(column => column.name === 'version_ids')) {
    persistentDatabase.exec("ALTER TABLE requirements ADD COLUMN version_ids TEXT NOT NULL DEFAULT ''")
  }

  const projectCount = persistentDatabase.prepare('SELECT COUNT(*) AS count FROM projects').get() as { count: number }
  if (Number(projectCount.count) === 0) {
    const timestamp = new Date().toISOString()
    persistentDatabase.prepare(`
      INSERT INTO projects (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'project-asdp',
      'ForgePilot Platform',
      'ForgePilot 自主软件交付平台核心产品项目',
      timestamp,
      timestamp,
    )
  }

  persistentDatabase.prepare(`
    UPDATE projects
    SET name = ?, description = ?, updated_at = ?
    WHERE id = ? AND name = ? AND description = ?
  `).run(
    'ForgePilot Platform',
    'ForgePilot 自主软件交付平台核心产品项目',
    new Date().toISOString(),
    'project-asdp',
    'ASDP Platform',
    'Autonomous Software Delivery Platform 核心产品项目',
  )

  const insertStatus = persistentDatabase.prepare(`
    INSERT OR IGNORE INTO requirement_statuses
      (id, project_id, key, name, color, sort_order, is_initial, is_terminal, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const projectRows = persistentDatabase.prepare('SELECT id FROM projects').all() as { id: string }[]
  projectRows.forEach(({ id: projectId }) => {
    const existingStatuses = persistentDatabase.prepare('SELECT COUNT(*) AS count FROM requirement_statuses WHERE project_id = ?')
      .get(projectId) as { count: number }
    if (Number(existingStatuses.count) > 0) return
    const timestamp = new Date().toISOString()
    defaultRequirementStatuses.forEach(status => insertStatus.run(
      randomUUID(), projectId, status.key, status.name, status.color, status.sortOrder,
      Number(status.isInitial), Number(status.isTerminal), timestamp, timestamp,
    ))
  })

  const legacyStatuses = persistentDatabase.prepare(`
    SELECT DISTINCT project_id, status FROM requirements WHERE status_id IS NULL
  `).all() as { project_id: string, status: string }[]
  legacyStatuses.forEach((legacy, index) => {
    const defaultStatus = defaultRequirementStatuses.find(status => status.key === legacy.status)
    const timestamp = new Date().toISOString()
    insertStatus.run(
      randomUUID(), legacy.project_id, legacy.status,
      defaultStatus?.name || legacy.status, defaultStatus?.color || '#667085',
      defaultStatus?.sortOrder || 100 + index, Number(defaultStatus?.isInitial || false),
      Number(defaultStatus?.isTerminal || false), timestamp, timestamp,
    )
    persistentDatabase.prepare(`
      UPDATE requirements
      SET status_id = (
        SELECT id FROM requirement_statuses
        WHERE project_id = requirements.project_id AND key = requirements.status
      )
      WHERE project_id = ? AND status = ? AND status_id IS NULL
    `).run(legacy.project_id, legacy.status)
  })

  return persistentDatabase
}

if (!globalDatabase.__asdpDatabasePromise) {
  globalDatabase.__asdpDatabasePromise = createDatabase()
}

const database = await globalDatabase.__asdpDatabasePromise

export const useDatabase = () => database

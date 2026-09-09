import type { Database } from 'sql.js'

export const workflowEventTables = {
  workflow_definitions: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    trigger_kind TEXT CHECK(trigger_kind IN ('manual', 'requirement-created', 'requirement-status-changed')),
    trigger_x REAL,
    trigger_y REAL,
    trigger_status_ids_json TEXT,
    nodes_json TEXT NOT NULL DEFAULT '[]',
    edges_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  `,
  domain_events: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK(event_type IN ('requirement-created', 'requirement-status-changed')),
    subject_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  `,
}

export const migrateWorkflowEventTables = (database: Database) => {
  const tables = database.exec(`
    SELECT name, sql FROM sqlite_master
    WHERE type = 'table' AND name IN ('workflow_definitions', 'domain_events')
  `)[0]?.values.filter(([, sql]) => !String(sql).includes("'requirement-status-changed'")) ?? []
  if (!tables.length) return
  const existingViolations = new Set((database.exec('PRAGMA foreign_key_check')[0]?.values ?? [])
    .map(violation => JSON.stringify(violation)))

  database.run('PRAGMA foreign_keys = OFF')
  database.run('BEGIN')
  try {
    for (const [name] of tables) {
      const table = String(name) as keyof typeof workflowEventTables
      const indexes = database.exec(`
        SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = '${table}' AND sql IS NOT NULL
      `)[0]?.values ?? []
      const columns = database.exec(`PRAGMA table_info(${table})`)[0]!.values
        .map(column => String(column[1])).join(', ')
      database.run(`
        CREATE TABLE ${table}_event_migration (${workflowEventTables[table]});
        INSERT INTO ${table}_event_migration (rowid, ${columns}) SELECT rowid, ${columns} FROM ${table};
        DROP TABLE ${table};
        ALTER TABLE ${table}_event_migration RENAME TO ${table};
      `)
      for (const [sql] of indexes) database.run(String(sql))
    }
    const violations = database.exec('PRAGMA foreign_key_check')[0]?.values ?? []
    if (violations.some(violation => !existingViolations.has(JSON.stringify(violation)))) {
      throw new Error('Workflow event migration did not preserve foreign key references')
    }
    database.run('COMMIT')
  } catch (error) {
    database.run('ROLLBACK')
    throw error
  } finally {
    database.run('PRAGMA foreign_keys = ON')
  }
}

export const migrateWorkflowTriggerStatusFilter = (database: Database) => {
  const columns = database.exec('PRAGMA table_info(workflow_definitions)')[0]?.values ?? []
  if (!columns.some(column => column[1] === 'trigger_status_ids_json')) {
    database.run('ALTER TABLE workflow_definitions ADD COLUMN trigger_status_ids_json TEXT')
  }
}

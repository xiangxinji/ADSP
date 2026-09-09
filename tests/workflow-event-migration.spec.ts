import { resolve } from 'node:path'
import initSqlJs, { type Database } from 'sql.js'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { migrateWorkflowEventTables, workflowEventTables } from '../server/utils/workflow-event-migration'

let database: Database
const rows = (sql: string) => database.exec(sql)[0]?.values ?? []

describe('workflow event schema migration', () => {
  beforeEach(async () => {
    const SQL = await initSqlJs({ locateFile: () => resolve('node_modules/sql.js/dist/sql-wasm.wasm') })
    database = new SQL.Database()
    database.run(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE projects (id TEXT PRIMARY KEY);
      CREATE TABLE workflow_definitions (
        ${workflowEventTables.workflow_definitions.replace(", 'requirement-status-changed'", '')}
      );
      CREATE TABLE domain_events (
        ${workflowEventTables.domain_events.replace(", 'requirement-status-changed'", '')},
        UNIQUE(event_type, subject_id)
      );
      CREATE TABLE workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT REFERENCES workflow_definitions(id) ON DELETE CASCADE,
        trigger_event_id TEXT REFERENCES domain_events(id) ON DELETE SET NULL
      );
      CREATE INDEX domain_events_pending ON domain_events(status, created_at);
      CREATE INDEX idx_workflow_definitions_project ON workflow_definitions(project_id, updated_at);
      INSERT INTO projects VALUES ('project');
      INSERT INTO workflow_definitions
        (id, project_id, name, trigger_kind, nodes_json, edges_json, created_at, updated_at)
        VALUES ('workflow', 'project', '旧定义', 'requirement-created', '[{"id":"node"}]', '[]', '1', '1');
      INSERT INTO domain_events
        (id, project_id, event_type, subject_id, payload_json, status, attempts, last_error, created_at, updated_at)
        VALUES ('event', 'project', 'requirement-created', 'requirement', '{"id":"requirement"}', 'processing', 2, 'retry', '1', '2');
      INSERT INTO workflow_runs VALUES ('run', 'workflow', 'event');
    `)
  })

  afterEach(() => database.close())

  test('preserves definitions, event payloads, processing state, indexes, and dependent run references', () => {
    const before = {
      definitions: rows('SELECT * FROM workflow_definitions'),
      events: rows('SELECT * FROM domain_events'),
      runs: rows('SELECT * FROM workflow_runs'),
    }
    migrateWorkflowEventTables(database)
    expect(rows('SELECT * FROM workflow_definitions')).toEqual(before.definitions)
    expect(rows('SELECT * FROM domain_events')).toEqual(before.events)
    expect(rows('SELECT * FROM workflow_runs')).toEqual(before.runs)
    expect(rows('PRAGMA foreign_key_check')).toEqual([])
    expect(rows('PRAGMA foreign_keys')).toEqual([[1]])
    expect(rows("SELECT name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name"))
      .toEqual([['domain_events_pending'], ['idx_workflow_definitions_project']])
    expect(rows('PRAGMA foreign_key_list(workflow_runs)').map(row => row[2]).sort())
      .toEqual(['domain_events', 'workflow_definitions'])
    database.run("UPDATE workflow_definitions SET trigger_kind = 'requirement-status-changed'")
    for (const id of ['change-1', 'change-2']) {
      database.run(`
        INSERT INTO domain_events
          (id, project_id, event_type, subject_id, payload_json, status, created_at, updated_at)
          VALUES (?, 'project', 'requirement-status-changed', 'requirement', '{}', 'pending', '3', '3')
      `, [id])
    }
    expect(rows('SELECT COUNT(*) FROM domain_events')).toEqual([[3]])
    expect(() => database.run("UPDATE workflow_definitions SET trigger_kind = 'invalid'")).toThrow()
    expect(() => database.run("UPDATE domain_events SET event_type = 'invalid'")).toThrow()
    migrateWorkflowEventTables(database)
    expect(rows('SELECT COUNT(*) FROM domain_events')).toEqual([[3]])
    database.run("DELETE FROM projects WHERE id = 'project'")
    expect(rows('SELECT * FROM workflow_runs')).toEqual([])
    expect(rows('SELECT * FROM domain_events')).toEqual([])
  })

  test('preserves pre-existing orphan records without blocking migration or changing their row IDs', () => {
    database.run("PRAGMA foreign_keys = OFF; UPDATE workflow_runs SET trigger_event_id = 'missing'; PRAGMA foreign_keys = ON;")
    database.run("PRAGMA foreign_keys = OFF; UPDATE workflow_definitions SET rowid = 42, project_id = 'missing'; PRAGMA foreign_keys = ON;")
    const violations = rows('PRAGMA foreign_key_check')
    migrateWorkflowEventTables(database)
    expect(new Set(rows('PRAGMA foreign_key_check').map(row => JSON.stringify(row))))
      .toEqual(new Set(violations.map(row => JSON.stringify(row))))
    expect(rows('SELECT rowid FROM workflow_definitions')).toEqual([[42]])
    expect(rows('SELECT * FROM workflow_runs')).toEqual([['run', 'workflow', 'missing']])
    expect(rows('PRAGMA foreign_keys')).toEqual([[1]])
  })

  test('rolls back rebuilt tables on an unsupported legacy schema and restores foreign keys', () => {
    database.run('ALTER TABLE domain_events ADD COLUMN unexpected_legacy_field TEXT')
    expect(() => migrateWorkflowEventTables(database)).toThrow('unexpected_legacy_field')
    expect(rows("SELECT sql FROM sqlite_master WHERE name = 'domain_events'")[0]![0])
      .toContain('UNIQUE(event_type, subject_id)')
    expect(rows("SELECT sql FROM sqlite_master WHERE name = 'workflow_definitions'")[0]![0])
      .not.toContain('requirement-status-changed')
    expect(rows('SELECT * FROM workflow_runs')).toEqual([['run', 'workflow', 'event']])
    expect(rows('PRAGMA foreign_keys')).toEqual([[1]])
  })
})

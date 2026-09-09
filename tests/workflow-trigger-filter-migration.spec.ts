import { resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { expect, test } from 'vitest'
import { migrateWorkflowTriggerStatusFilter, workflowEventTables } from '../server/utils/workflow-event-migration'

test('adds a nullable target-status filter to existing trigger definitions without changing them', async () => {
  const SQL = await initSqlJs({ locateFile: () => resolve('node_modules/sql.js/dist/sql-wasm.wasm') })
  const database = new SQL.Database()
  try {
    database.run(`
      CREATE TABLE projects (id TEXT PRIMARY KEY);
      CREATE TABLE workflow_definitions (${workflowEventTables.workflow_definitions.replace('    trigger_status_ids_json TEXT,\n', '')});
      INSERT INTO projects VALUES ('project');
      INSERT INTO workflow_definitions (id, project_id, name, trigger_kind, created_at, updated_at)
        VALUES ('workflow', 'project', '旧需求状态触发器', 'requirement-status-changed', '1', '1');
    `)
    const before = database.exec('SELECT id, name, trigger_kind FROM workflow_definitions')[0]!.values
    migrateWorkflowTriggerStatusFilter(database)
    expect(database.exec('SELECT id, name, trigger_kind FROM workflow_definitions')[0]!.values).toEqual(before)
    expect(database.exec('SELECT trigger_status_ids_json FROM workflow_definitions')[0]!.values).toEqual([[null]])
    database.run('UPDATE workflow_definitions SET trigger_status_ids_json = ?', ['["ready","review"]'])
    migrateWorkflowTriggerStatusFilter(database)
    expect(database.exec('SELECT trigger_status_ids_json FROM workflow_definitions')[0]!.values).toEqual([['["ready","review"]']])
    expect(database.exec('PRAGMA foreign_key_check')).toEqual([])
  } finally {
    database.close()
  }
})

import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { useDatabase } from '../utils/database'

type WorkflowRunRow = {
  id: string
  workflow_id: string
  trigger_event_id: string | null
  definition_json: string
  status: WorkflowRun['status']
  steps_json: string
  started_at: string
  finished_at: string | null
}

type WorkflowRunState = Pick<WorkflowRun, 'root' | 'steps' | 'output' | 'referencedWorkflowIds'>

const runStateFromJson = (json: string): WorkflowRunState => {
  const value = JSON.parse(json)
  return Array.isArray(value) ? { root: {}, steps: value } : {
    root: Object.hasOwn(value, 'root') ? value.root : {}, steps: value.steps || [],
    ...(Object.hasOwn(value, 'output') ? { output: value.output } : {}),
    ...(value.referencedWorkflowIds ? { referencedWorkflowIds: value.referencedWorkflowIds } : {}),
  }
}

const runFromRow = (row: WorkflowRunRow): WorkflowRun => {
  const state = runStateFromJson(row.steps_json)
  return {
    id: row.id,
    workflowId: row.workflow_id,
    ...(row.trigger_event_id ? { triggerEventId: row.trigger_event_id } : {}),
    workflow: JSON.parse(row.definition_json),
    ...state,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}

const runStateJson = (run: WorkflowRun) => JSON.stringify({
  root: run.root, steps: run.steps, output: run.output, referencedWorkflowIds: run.referencedWorkflowIds,
})

export const listWorkflowRuns = (workflowId: string) => (useDatabase().prepare(`
  SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC, rowid DESC
`).all(workflowId) as WorkflowRunRow[]).map(runFromRow)

export const listActiveWorkflowRuns = () => (useDatabase().prepare(`
  SELECT * FROM workflow_runs WHERE status = 'running'
`).all() as WorkflowRunRow[]).map(runFromRow)

export const findWorkflowRunForTriggerEvent = (workflowId: string, triggerEventId: string) => {
  const row = useDatabase().prepare(`
    SELECT * FROM workflow_runs WHERE workflow_id = ? AND trigger_event_id = ?
  `).get(workflowId, triggerEventId) as WorkflowRunRow | undefined
  return row ? runFromRow(row) : undefined
}

export const insertWorkflowRun = (run: WorkflowRun) => {
  useDatabase().prepare(`
    INSERT INTO workflow_runs
      (id, workflow_id, trigger_event_id, project_id, definition_json, status, steps_json, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(run.id, run.workflowId, run.triggerEventId || null, run.workflow.projectId, JSON.stringify(run.workflow), run.status,
    runStateJson(run), run.startedAt, run.finishedAt)
}

export const updateWorkflowRun = (run: WorkflowRun) => {
  useDatabase().prepare(`
    UPDATE workflow_runs SET status = ?, steps_json = ?, finished_at = ? WHERE id = ?
  `).run(run.status, runStateJson(run), run.finishedAt, run.id)
}

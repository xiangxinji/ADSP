import type { WorkflowRun } from '../../shared/types/workflow-runs'
import { useDatabase } from '../utils/database'

type WorkflowRunRow = {
  id: string
  workflow_id: string
  definition_json: string
  status: WorkflowRun['status']
  steps_json: string
  started_at: string
  finished_at: string | null
}

const runFromRow = (row: WorkflowRunRow): WorkflowRun => ({
  id: row.id,
  workflowId: row.workflow_id,
  workflow: JSON.parse(row.definition_json),
  status: row.status,
  steps: JSON.parse(row.steps_json),
  startedAt: row.started_at,
  finishedAt: row.finished_at,
})

export const listWorkflowRuns = (workflowId: string) => (useDatabase().prepare(`
  SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC, rowid DESC
`).all(workflowId) as WorkflowRunRow[]).map(runFromRow)

export const listActiveWorkflowRuns = () => (useDatabase().prepare(`
  SELECT * FROM workflow_runs WHERE status = 'running'
`).all() as WorkflowRunRow[]).map(runFromRow)

export const insertWorkflowRun = (run: WorkflowRun) => {
  useDatabase().prepare(`
    INSERT INTO workflow_runs (id, workflow_id, project_id, definition_json, status, steps_json, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(run.id, run.workflowId, run.workflow.projectId, JSON.stringify(run.workflow), run.status,
    JSON.stringify(run.steps), run.startedAt, run.finishedAt)
}

export const updateWorkflowRun = (run: WorkflowRun) => {
  useDatabase().prepare(`
    UPDATE workflow_runs SET status = ?, steps_json = ?, finished_at = ? WHERE id = ?
  `).run(run.status, JSON.stringify(run.steps), run.finishedAt, run.id)
}

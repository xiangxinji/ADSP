import type { WorkflowDefinition, WorkflowOperationNode, WorkflowTriggerKind } from '../../shared/types/asdp'
import { useDatabase } from '../utils/database'

type WorkflowDefinitionRow = {
  id: string
  project_id: string
  name: string
  note: string
  trigger_kind: WorkflowTriggerKind | null
  trigger_x: number | null
  trigger_y: number | null
  nodes_json: string
  created_at: string
  updated_at: string
}

const workflowFromRow = (row: WorkflowDefinitionRow): WorkflowDefinition => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  note: row.note,
  trigger: row.trigger_kind === null ? null : {
    kind: row.trigger_kind,
    position: { x: Number(row.trigger_x), y: Number(row.trigger_y) },
  },
  nodes: JSON.parse(row.nodes_json) as WorkflowOperationNode[],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const findWorkflowDefinition = (id: string) => {
  const row = useDatabase().prepare('SELECT * FROM workflow_definitions WHERE id = ?')
    .get(id) as WorkflowDefinitionRow | undefined
  return row ? workflowFromRow(row) : undefined
}

export const listWorkflowDefinitions = (projectId: string) => (useDatabase().prepare(`
  SELECT * FROM workflow_definitions
  WHERE project_id = ? ORDER BY updated_at DESC
`).all(projectId) as WorkflowDefinitionRow[]).map(workflowFromRow)

export const insertWorkflowDefinition = (workflow: WorkflowDefinition) => {
  useDatabase().prepare(`
    INSERT INTO workflow_definitions
      (id, project_id, name, note, trigger_kind, trigger_x, trigger_y, nodes_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    workflow.id,
    workflow.projectId,
    workflow.name,
    workflow.note,
    workflow.trigger?.kind || null,
    workflow.trigger?.position.x ?? null,
    workflow.trigger?.position.y ?? null,
    JSON.stringify(workflow.nodes),
    workflow.createdAt,
    workflow.updatedAt,
  )
}

export const updateWorkflowDefinitionRecord = (workflow: WorkflowDefinition) => {
  useDatabase().prepare(`
    UPDATE workflow_definitions
    SET name = ?, note = ?, trigger_kind = ?, trigger_x = ?, trigger_y = ?, nodes_json = ?, updated_at = ?
    WHERE id = ?
  `).run(
    workflow.name,
    workflow.note,
    workflow.trigger?.kind || null,
    workflow.trigger?.position.x ?? null,
    workflow.trigger?.position.y ?? null,
    JSON.stringify(workflow.nodes),
    workflow.updatedAt,
    workflow.id,
  )
}

export const removeWorkflowDefinition = (id: string) => {
  useDatabase().prepare('DELETE FROM workflow_definitions WHERE id = ?').run(id)
}

export const removeWorkflowDefinitionsForProject = (projectId: string) => {
  useDatabase().prepare('DELETE FROM workflow_definitions WHERE project_id = ?').run(projectId)
}

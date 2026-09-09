import type { WorkflowEventTriggerKind, WorkflowValueObject } from '../../shared/types/asdp'
import { useDatabase } from '../utils/database'

export type DomainEventStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type DomainEvent = {
  id: string
  projectId: string
  type: WorkflowEventTriggerKind
  subjectId: string
  payload: WorkflowValueObject
  status: DomainEventStatus
  attempts: number
  lastError: string | null
  createdAt: string
  updatedAt: string
}

type DomainEventRow = {
  id: string
  project_id: string
  event_type: DomainEvent['type']
  subject_id: string
  payload_json: string
  status: DomainEventStatus
  attempts: number
  last_error: string | null
  created_at: string
  updated_at: string
}

const eventFromRow = (row: DomainEventRow): DomainEvent => ({
  id: row.id,
  projectId: row.project_id,
  type: row.event_type,
  subjectId: row.subject_id,
  payload: JSON.parse(row.payload_json),
  status: row.status,
  attempts: Number(row.attempts),
  lastError: row.last_error,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const insertDomainEvent = (event: DomainEvent) => {
  useDatabase().prepare(`
    INSERT INTO domain_events
      (id, project_id, event_type, subject_id, payload_json, status, attempts, last_error, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id, event.projectId, event.type, event.subjectId, JSON.stringify(event.payload),
    event.status, event.attempts, event.lastError, event.createdAt, event.updatedAt,
  )
}

export const nextPendingDomainEvent = () => {
  const row = useDatabase().prepare(`
    SELECT * FROM domain_events WHERE status = 'pending' ORDER BY created_at, rowid LIMIT 1
  `).get() as DomainEventRow | undefined
  return row ? eventFromRow(row) : undefined
}

export const markDomainEventProcessing = (id: string) => {
  useDatabase().prepare(`
    UPDATE domain_events SET status = 'processing', attempts = attempts + 1, updated_at = ? WHERE id = ?
  `).run(new Date().toISOString(), id)
}

export const markDomainEventCompleted = (id: string) => {
  useDatabase().prepare(`
    UPDATE domain_events SET status = 'completed', last_error = NULL, updated_at = ? WHERE id = ?
  `).run(new Date().toISOString(), id)
}

export const markDomainEventFailed = (id: string, error: string) => {
  useDatabase().prepare(`
    UPDATE domain_events SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?
  `).run(error, new Date().toISOString(), id)
}

export const recoverProcessingDomainEvents = () => {
  useDatabase().prepare(`
    UPDATE domain_events SET status = 'pending', updated_at = ? WHERE status = 'processing'
  `).run(new Date().toISOString())
}

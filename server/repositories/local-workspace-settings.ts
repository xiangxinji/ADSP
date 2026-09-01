import { useDatabase } from '../utils/database'

export type LocalWorkspaceSettingsRecord = {
  path: string
  createdAt: string
  updatedAt: string
}

type LocalWorkspaceSettingsRow = {
  workspace_path: string
  created_at: string
  updated_at: string
}

export const findLocalWorkspaceSettingsRecord = () => {
  const row = useDatabase().prepare(`
    SELECT workspace_path, created_at, updated_at
    FROM local_workspace_settings WHERE id = 1
  `).get() as LocalWorkspaceSettingsRow | undefined
  if (!row) return undefined
  return {
    path: row.workspace_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies LocalWorkspaceSettingsRecord
}

export const upsertLocalWorkspaceSettingsRecord = (settings: LocalWorkspaceSettingsRecord) => {
  useDatabase().prepare(`
    INSERT INTO local_workspace_settings (id, workspace_path, created_at, updated_at)
    VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      workspace_path = excluded.workspace_path,
      updated_at = excluded.updated_at
  `).run(settings.path, settings.createdAt, settings.updatedAt)
}

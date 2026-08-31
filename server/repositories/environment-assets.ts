import type { EnvironmentAccount, EnvironmentAsset } from '../../shared/types/asdp'
import { useDatabase } from '../utils/database'

type EnvironmentRow = {
  id: string
  project_id: string
  address: string
  note: string
  environment_type: EnvironmentAsset['type']
  created_at: string
  updated_at: string
}

const listEnvironmentAccounts = (environmentId: string) => (useDatabase().prepare(`
  SELECT account, password FROM environment_accounts
  WHERE environment_id = ? ORDER BY sort_order, account
`).all(environmentId) as EnvironmentAccount[])

const environmentFromRow = (row: EnvironmentRow): EnvironmentAsset => ({
  id: row.id,
  projectId: row.project_id,
  address: row.address,
  note: row.note || '',
  type: row.environment_type,
  accounts: listEnvironmentAccounts(row.id),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const findEnvironmentAsset = (id: string) => {
  const row = useDatabase().prepare(`
    SELECT * FROM environment_assets WHERE id = ?
  `).get(id) as EnvironmentRow | undefined
  return row ? environmentFromRow(row) : undefined
}

export const listEnvironmentAssets = (projectId: string) => (useDatabase().prepare(`
  SELECT * FROM environment_assets
  WHERE project_id = ? ORDER BY updated_at DESC
`).all(projectId) as EnvironmentRow[]).map(environmentFromRow)

export const insertEnvironmentAsset = (environment: EnvironmentAsset) => {
  useDatabase().prepare(`
    INSERT INTO environment_assets
      (id, project_id, address, note, environment_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    environment.id,
    environment.projectId,
    environment.address,
    environment.note,
    environment.type,
    environment.createdAt,
    environment.updatedAt,
  )
}

export const updateEnvironmentAssetRecord = (environment: EnvironmentAsset) => {
  useDatabase().prepare(`
    UPDATE environment_assets
    SET address = ?, note = ?, environment_type = ?, updated_at = ?
    WHERE id = ?
  `).run(environment.address, environment.note, environment.type, environment.updatedAt, environment.id)
}

export const replaceEnvironmentAccounts = (environmentId: string, accounts: EnvironmentAccount[]) => {
  const database = useDatabase()
  database.prepare('DELETE FROM environment_accounts WHERE environment_id = ?').run(environmentId)
  const insertAccount = database.prepare(`
    INSERT INTO environment_accounts (environment_id, account, password, sort_order)
    VALUES (?, ?, ?, ?)
  `)
  accounts.forEach((account, index) => insertAccount.run(
    environmentId,
    account.account,
    account.password,
    index,
  ))
}

export const removeEnvironmentAsset = (id: string) => {
  useDatabase().prepare('DELETE FROM environment_assets WHERE id = ?').run(id)
}

import type { ManagedUserAccount, UserAccount } from '../../shared/types/asdp'
import { useDatabase } from '../utils/database'

type UserRow = {
  id: string
  name: string
  email: string
  role: UserAccount['role']
  created_at: string
  updated_at: string
}

type ManagedUserRow = UserRow & {
  has_password: number
}

const userFromRow = (row: UserRow): UserAccount => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const findUser = (id: string) => {
  const row = useDatabase().prepare(`
    SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?
  `).get(id) as UserRow | undefined
  return row ? userFromRow(row) : undefined
}

export const listUserAccounts = (): ManagedUserAccount[] => (useDatabase().prepare(`
  SELECT id, name, email, role, password_hash IS NOT NULL AS has_password, created_at, updated_at
  FROM users ORDER BY updated_at DESC
`).all() as ManagedUserRow[]).map(row => ({
  ...userFromRow(row),
  hasPassword: Boolean(row.has_password),
}))

export const insertUser = (user: UserAccount, passwordHash: string) => {
  useDatabase().prepare(`
    INSERT INTO users (id, name, email, role, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, user.name, user.email, user.role, passwordHash, user.createdAt, user.updatedAt)
}

export const updateUserPasswordHash = (id: string, passwordHash: string, updatedAt: string) => {
  useDatabase().prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(passwordHash, updatedAt, id)
}

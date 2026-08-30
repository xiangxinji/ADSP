import type { UserAccount } from '../../shared/types/asdp'
import { useDatabase } from '../utils/database'

type UserRow = {
  id: string
  name: string
  email: string
  role: UserAccount['role']
  created_at: string
  updated_at: string
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
  const row = useDatabase().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  return row ? userFromRow(row) : undefined
}

export const listUserAccounts = (): UserAccount[] => (useDatabase().prepare(`
  SELECT * FROM users ORDER BY updated_at DESC
`).all() as UserRow[]).map(userFromRow)

export const insertUser = (user: UserAccount) => {
  useDatabase().prepare(`
    INSERT INTO users (id, name, email, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user.id, user.name, user.email, user.role, user.createdAt, user.updatedAt)
}

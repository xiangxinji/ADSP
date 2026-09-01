import { promisify } from 'node:util'
import { randomBytes, scrypt } from 'node:crypto'

const deriveKey = promisify(scrypt)

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16)
  const hash = await deriveKey(password, salt, 64) as Buffer
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

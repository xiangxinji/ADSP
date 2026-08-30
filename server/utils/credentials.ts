import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const algorithm = 'aes-256-gcm'
let credentialKey: Buffer | undefined

const readLocalKey = (keyPath: string) => {
  const encodedKey = readFileSync(keyPath, 'utf8').trim()
  const key = Buffer.from(encodedKey, 'base64')
  if (key.length !== 32) throw new Error('ASDP credential key is invalid')
  return key
}

const useCredentialKey = () => {
  if (credentialKey) return credentialKey

  const configuredKey = process.env.ASDP_CREDENTIAL_ENCRYPTION_KEY?.trim()
  if (configuredKey) {
    credentialKey = createHash('sha256').update(configuredKey).digest()
    return credentialKey
  }

  const keyPath = process.env.ASDP_CREDENTIAL_KEY_PATH || resolve(process.cwd(), '.data', 'credential.key')
  mkdirSync(dirname(keyPath), { recursive: true })

  if (!existsSync(keyPath)) {
    const generatedKey = randomBytes(32)
    try {
      writeFileSync(keyPath, generatedKey.toString('base64'), { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error
    }
  }

  credentialKey = readLocalKey(keyPath)
  return credentialKey
}

export const encryptCredential = (plaintext: string) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv(algorithm, useCredentialKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export const decryptCredential = (value: string) => {
  const [version, ivValue, tagValue, encryptedValue] = value.split(':')
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('ASDP credential value is invalid')
  }

  const decipher = createDecipheriv(algorithm, useCredentialKey(), Buffer.from(ivValue, 'base64'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

import { describe, expect, test } from 'vitest'
import type { EnvironmentAsset } from '../../shared/types/asdp'
import { startApiTestHarness } from '../support/api-test-harness'

describe('environment assets with optional test accounts', () => {
  test('accepts no accounts and accounts without passwords', async () => {
    const harness = await startApiTestHarness()
    try {
      const created = await harness.request<EnvironmentAsset>('/api/projects/project-asdp/environments', {
        method: 'POST',
        body: {
          address: 'https://optional-accounts.example.com',
          note: '',
          type: 'testing',
          accounts: [],
        },
      })

      expect(created.status).toBe(201)
      expect(created.data.accounts).toEqual([])

      const updated = await harness.request<EnvironmentAsset>(`/api/environments/${created.data.id}`, {
        method: 'PATCH',
        body: { accounts: [{ account: 'qa-user' }] },
      })

      expect(updated.status).toBe(200)
      expect(updated.data.accounts).toEqual([{ account: 'qa-user', password: '' }])
    } finally {
      await harness.stop()
    }
  })
})

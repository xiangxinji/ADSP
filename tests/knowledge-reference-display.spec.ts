import { describe, expect, test } from 'vitest'
import {
  missingAssetReferenceLabel,
  missingAssetReferenceMessage,
} from '../app/utils/knowledge-reference-display'

describe('missing asset reference display', () => {
  test('provides a visible warning label and hover message with the original target', () => {
    expect(missingAssetReferenceLabel).toBe('资产不存在')
    expect(missingAssetReferenceMessage('repository', 'repo-1'))
      .toBe('引用的资产不存在：repository：repo-1')
  })
})

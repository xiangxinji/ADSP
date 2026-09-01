import { describe, expect, test } from 'vitest'
import {
  findInlineAssetSlashMatch,
  matchesInlineAssetSlashQuery,
} from '../app/editor/inline-asset-slash'

describe('inline asset slash menu', () => {
  test('matches a slash typed after existing text', () => {
    expect(findInlineAssetSlashMatch('在这里引用/仓库')).toEqual({
      slashOffset: 5,
      query: '仓库',
    })
  })

  test('leaves the block-leading slash to the full block menu', () => {
    expect(findInlineAssetSlashMatch('/标题')).toBeNull()
  })

  test('does not open for common URL and path prefixes', () => {
    expect(findInlineAssetSlashMatch('https://forgepilot.example')).toBeNull()
    expect(findInlineAssetSlashMatch('C:/workspace')).toBeNull()
  })

  test('closes when the query becomes a separate word', () => {
    expect(findInlineAssetSlashMatch('正文/项目 成员')).toBeNull()
  })

  test('filters assets by type, label, or detail', () => {
    const option = {
      typeLabel: '代码仓库',
      label: 'ForgePilot Web',
      detail: 'main branch',
    }

    expect(matchesInlineAssetSlashQuery(option, '仓库')).toBe(true)
    expect(matchesInlineAssetSlashQuery(option, 'forgepilot')).toBe(true)
    expect(matchesInlineAssetSlashQuery(option, 'BRANCH')).toBe(true)
    expect(matchesInlineAssetSlashQuery(option, '环境')).toBe(false)
  })
})

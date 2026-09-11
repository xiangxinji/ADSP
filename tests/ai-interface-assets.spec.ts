import { describe, expect, test } from 'vitest'
import { aiInterfacePayload } from '../server/validation/ai-interface-assets'
import { assetOperationsForModule } from '../shared/config/asset-operations'
import { aiInterfaceReferenceOptions } from '../app/utils/ai-interface-references'
import { matchesInlineAssetSlashQuery } from '../app/editor/inline-asset-slash'
import { createKnowledgeReferenceToken } from '../app/editor/knowledge-reference-syntax'

const valid = { provider: 'DeepSeek', name: '需求分析', apiKey: 'test-only-ai-key' }

describe('AI interface asset validation', () => {
  test('accepts custom platforms and trims input', () => {
    expect(aiInterfacePayload({ provider: ' 自建平台 ', name: ' 内部接口 ', apiKey: ' test-only-ai-key ' }))
      .toEqual({ provider: '自建平台', name: '内部接口', apiKey: valid.apiKey })
  })

  test.each(['provider', 'name', 'apiKey'])('requires a nonempty string for %s', field => {
    for (const value of [undefined, null, '', '   ', 42, {}, []]) {
      expect(() => aiInterfacePayload({ ...valid, [field]: value })).toThrow()
    }
  })

  test.each([
    { provider: 'a'.repeat(101) }, { name: 'a'.repeat(101) }, { apiKey: 'a'.repeat(4097) },
    { provider: 'Deep\nSeek' }, { name: 'bad\u0000name' }, { apiKey: 'key\nvalue' },
    { projectId: 'another-project' }, { encryptedApiKey: 'untrusted' },
  ])('rejects invalid fields without including their values in errors: %j', fields => {
    expect(() => aiInterfacePayload({ ...valid, ...fields })).toThrow()
  })

  test.each([null, [], 'invalid', 42])('rejects non-object bodies: %j', body => {
    expect(() => aiInterfacePayload(body)).toThrow()
  })

  test('leaves omitted update fields unset and refuses to clear the key', () => {
    expect(aiInterfacePayload({ name: '新名称' }, true)).toEqual({ name: '新名称', provider: undefined, apiKey: undefined })
    expect(aiInterfacePayload({ apiKey: 'replacement-test-key' }, true).apiKey).toBe('replacement-test-key')
    for (const apiKey of ['', ' ', null]) {
      expect(() => aiInterfacePayload({ apiKey }, true)).toThrow()
    }
  })
})

describe('AI interface editor shortcuts', () => {
  test('includes only public metadata and can be found by platform, type or name', () => {
    const options = aiInterfaceReferenceOptions([{
      id: 'ai-example', projectId: 'project-example', provider: 'DeepSeek', name: '需求分析',
      hasApiKey: true, createdAt: '', updatedAt: '',
    }])
    expect(options).toEqual([{
      targetType: 'ai-interface', typeLabel: 'AI 接口', recordId: 'ai-example', label: '需求分析', detail: 'DeepSeek',
    }])
    for (const query of ['deepseek', 'AI', '需求分析']) {
      expect(matchesInlineAssetSlashQuery(options[0]!, query)).toBe(true)
    }
    expect(createKnowledgeReferenceToken(options[0]!.targetType, options[0]!.recordId)).toBe('[[ai-interface:ai-example]]')
    expect(aiInterfaceReferenceOptions([])).toEqual([])
  })

  test('keeps configuration management outside workflow command contracts', () => {
    const operations = assetOperationsForModule('ai-interfaces')
    expect(operations.map(operation => operation.id)).toEqual(['ai-interface.edit', 'ai-interface.delete'])
    expect(operations.every(operation => operation.execution.kind === 'client' && !operation.workflow.enabled)).toBe(true)
  })
})

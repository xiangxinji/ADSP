import { describe, expect, test } from 'vitest'
import {
  splitKnowledgeReferenceText,
  transformKnowledgeReferenceTree,
} from '../app/editor/knowledge-reference-syntax'

describe('knowledge asset reference syntax', () => {
  test('splits references while preserving the authored token', () => {
    expect(splitKnowledgeReferenceText('前 [[代码仓库：repo-1]] 中 [[member: member-2]] 后')).toEqual([
      { type: 'text', value: '前 ' },
      {
        type: 'assetReference',
        assetType: '代码仓库',
        recordId: 'repo-1',
        raw: '[[代码仓库：repo-1]]',
      },
      { type: 'text', value: ' 中 ' },
      {
        type: 'assetReference',
        assetType: 'member',
        recordId: 'member-2',
        raw: '[[member: member-2]]',
      },
      { type: 'text', value: ' 后' },
    ])
  })

  test('leaves text without complete references unchanged', () => {
    expect(splitKnowledgeReferenceText('[[知识：unfinished')).toEqual([
      { type: 'text', value: '[[知识：unfinished' },
    ])
  })

  test('transforms nested Markdown text nodes but not code values', () => {
    const tree = {
      type: 'root',
      children: [{
        type: 'paragraph',
        children: [
          { type: 'text', value: '参见 [[环境：env-1]]' },
          { type: 'inlineCode', value: '[[环境：env-code]]' },
        ],
      }],
    }

    expect(transformKnowledgeReferenceTree(tree).children?.[0]?.children).toEqual([
      { type: 'text', value: '参见 ' },
      {
        type: 'assetReference',
        assetType: '环境',
        recordId: 'env-1',
        raw: '[[环境：env-1]]',
      },
      { type: 'inlineCode', value: '[[环境：env-code]]' },
    ])
  })
})

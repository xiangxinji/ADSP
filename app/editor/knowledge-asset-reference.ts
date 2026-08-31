import type { MilkdownPlugin } from '@milkdown/kit/ctx'
import type { Command } from '@milkdown/kit/prose/state'
import { nodeRule } from '@milkdown/kit/prose'
import { $inputRule, $nodeSchema, $remark, $useKeymap } from '@milkdown/kit/utils'
import type { KnowledgeReferenceMarkdownNode } from './knowledge-reference-syntax'
import {
  createKnowledgeReferenceToken,
  transformKnowledgeReferenceTree,
} from './knowledge-reference-syntax'

export type KnowledgeAssetReferenceOption = {
  assetType: string
  targetType: 'repository' | 'member' | 'environment' | 'knowledge'
  recordId: string
  label: string
  detail: string
}

const assetReferenceId = 'assetReference'
const typedReferencePattern = /\[\[([^\[\]：:]+?)\s*[：:]\s*([^\[\]]+?)\]\]$/

const assetTypeAliases: Record<string, KnowledgeAssetReferenceOption['targetType']> = {
  repository: 'repository',
  repositories: 'repository',
  '代码仓库': 'repository',
  '仓库': 'repository',
  member: 'member',
  members: 'member',
  '项目成员': 'member',
  '成员': 'member',
  environment: 'environment',
  environments: 'environment',
  '项目环境': 'environment',
  '环境': 'environment',
  knowledge: 'knowledge',
  '知识': 'knowledge',
}

const referenceType = (assetType: string) => assetTypeAliases[assetType.trim().toLowerCase()]

const deleteAdjacentReference = (direction: 'backward' | 'forward') =>
  (): Command => (state, dispatch) => {
    const { selection } = state
    if (!selection.empty) return false

    const adjacentNode = direction === 'backward' ? selection.$from.nodeBefore : selection.$from.nodeAfter
    if (adjacentNode?.type.name !== assetReferenceId) return false

    const from = direction === 'backward' ? selection.from - adjacentNode.nodeSize : selection.from
    const to = direction === 'backward' ? selection.from : selection.from + adjacentNode.nodeSize
    dispatch?.(state.tr.delete(from, to).scrollIntoView())
    return true
  }

export const createKnowledgeAssetReferencePlugins = (options: KnowledgeAssetReferenceOption[]): MilkdownPlugin[] => {
  const optionByTarget = new Map(options.map(option => [`${option.targetType}:${option.recordId}`, option]))

  const schema = $nodeSchema(assetReferenceId, () => ({
    inline: true,
    group: 'inline',
    atom: true,
    selectable: true,
    draggable: false,
    attrs: {
      assetType: { default: '' },
      recordId: { default: '' },
      raw: { default: '' },
    },
    parseDOM: [{
      tag: `span[data-type="${assetReferenceId}"]`,
      getAttrs: dom => ({
        assetType: (dom as HTMLElement).dataset.assetType || '',
        recordId: (dom as HTMLElement).dataset.recordId || '',
        raw: (dom as HTMLElement).dataset.raw || '',
      }),
    }],
    toDOM: (node) => {
      const assetType = String(node.attrs.assetType)
      const recordId = String(node.attrs.recordId)
      const option = optionByTarget.get(`${referenceType(assetType)}:${recordId}`)
      const root = document.createElement('span')
      root.className = `knowledge-asset-control${option ? '' : ' unresolved'}`
      root.dataset.type = assetReferenceId
      root.dataset.assetType = assetType
      root.dataset.recordId = recordId
      root.dataset.raw = String(node.attrs.raw)
      root.contentEditable = 'false'
      root.title = option
        ? `${option.assetType} · ${option.label} · ${option.detail}`
        : `未解析 · ${assetType}：${recordId}`

      const type = document.createElement('span')
      type.className = 'knowledge-asset-control-type'
      type.textContent = option?.assetType || assetType
      const content = document.createElement('span')
      content.className = 'knowledge-asset-control-content'
      const label = document.createElement('strong')
      label.textContent = option?.label || '未解析资产'
      const detail = document.createElement('small')
      detail.textContent = option?.detail || recordId
      content.append(label, detail)
      root.append(type, content)
      return root
    },
    parseMarkdown: {
      match: node => node.type === assetReferenceId,
      runner: (state, node, type) => {
        state.addNode(type, {
          assetType: String(node.assetType || ''),
          recordId: String(node.recordId || ''),
          raw: String(node.raw || ''),
        })
      },
    },
    toMarkdown: {
      match: node => node.type.name === assetReferenceId,
      runner: (state, node) => {
        const raw = String(node.attrs.raw)
          || createKnowledgeReferenceToken(
            String(node.attrs.assetType),
            String(node.attrs.recordId),
          )
        state.addNode('html', undefined, raw)
      },
    },
  }))

  const remarkPlugin = $remark<'knowledgeAssetReferences', undefined>(
    'knowledgeAssetReferences',
    () => () => (tree) => {
      transformKnowledgeReferenceTree(tree as unknown as KnowledgeReferenceMarkdownNode)
    },
  )

  const inputRule = $inputRule(ctx => nodeRule(typedReferencePattern, schema.type(ctx), {
    getAttr: match => ({
      assetType: match[1]?.trim() || '',
      recordId: match[2]?.trim() || '',
      raw: match[0],
    }),
  }))

  const keymap = $useKeymap('assetReference', {
    DeleteAssetReferenceBackward: {
      shortcuts: 'Backspace',
      priority: 100,
      command: deleteAdjacentReference('backward'),
    },
    DeleteAssetReferenceForward: {
      shortcuts: 'Delete',
      priority: 100,
      command: deleteAdjacentReference('forward'),
    },
  })

  return [
    ...remarkPlugin,
    ...schema,
    inputRule,
    ...keymap,
  ]
}

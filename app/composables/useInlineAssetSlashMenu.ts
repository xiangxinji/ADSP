import { Plugin, TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import type { KnowledgeAssetReferenceOption } from '~/editor/knowledge-asset-reference'
import { findInlineAssetSlashMatch, matchesInlineAssetSlashQuery } from '~/editor/inline-asset-slash'
import { createKnowledgeReferenceToken } from '~/editor/knowledge-reference-syntax'

export type InlineAssetMenuState = {
  from: number
  to: number
  left: number
  top: number
}

export const useInlineAssetSlashMenu = (
  references: () => KnowledgeAssetReferenceOption[],
  scrollActiveOptionIntoView: () => void,
) => {
  const menu = ref<InlineAssetMenuState | null>(null)
  const query = ref('')
  const activeIndex = ref(0)
  const options = computed(() => references().filter(option => matchesInlineAssetSlashQuery(option, query.value)))

  const close = () => {
    menu.value = null
    query.value = ''
    activeIndex.value = 0
  }

  const update = (view: EditorView) => {
    const { selection } = view.state
    if (!(selection instanceof TextSelection) || !selection.empty) {
      close()
      return
    }
    const { $from } = selection
    if (!['paragraph', 'heading'].includes($from.parent.type.name)) {
      close()
      return
    }
    const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, undefined, '\uFFFC')
    const match = findInlineAssetSlashMatch(textBeforeCursor)
    if (!match) {
      close()
      return
    }
    const coordinates = view.coordsAtPos(selection.from)
    const menuWidth = Math.min(360, window.innerWidth - 24)
    menu.value = {
      from: $from.start() + match.slashOffset,
      to: selection.from,
      left: Math.max(12, Math.min(coordinates.left, window.innerWidth - menuWidth - 12)),
      top: coordinates.bottom + 8,
    }
    query.value = match.query
    activeIndex.value = Math.min(activeIndex.value, Math.max(0, options.value.length - 1))
  }

  const insert = (view: EditorView, option: KnowledgeAssetReferenceOption) => {
    const currentMenu = menu.value
    const referenceNode = view.state.schema.nodes.assetReference
    if (!currentMenu || !referenceNode) return
    const raw = createKnowledgeReferenceToken(option.targetType, option.recordId)
    const node = referenceNode.create({ assetType: option.targetType, recordId: option.recordId, raw })
    close()
    view.dispatch(view.state.tr.replaceWith(currentMenu.from, currentMenu.to, node).scrollIntoView())
    view.focus()
  }

  const plugin = () => $prose(() => new Plugin({
    props: {
      handleKeyDown: (view, event) => {
        if (!menu.value) return false
        if (event.key === 'Escape') {
          event.preventDefault()
          close()
          return true
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const direction = event.key === 'ArrowDown' ? 1 : -1
          activeIndex.value = Math.max(0, Math.min(options.value.length - 1, activeIndex.value + direction))
          void nextTick(scrollActiveOptionIntoView)
          return true
        }
        if (event.key === 'Enter') {
          const option = options.value[activeIndex.value]
          if (!option) return false
          event.preventDefault()
          insert(view, option)
          return true
        }
        return false
      },
    },
    view: view => ({ update, destroy: close }),
  }))

  return { menu, query, activeIndex, options, close, insert, plugin }
}

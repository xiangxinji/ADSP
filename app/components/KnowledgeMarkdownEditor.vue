<script setup lang="ts">
import { Crepe } from '@milkdown/crepe'
import type { Ctx } from '@milkdown/kit/ctx'
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core'
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark'
import { Plugin, TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { $prose, replaceAll } from '@milkdown/kit/utils'
import type { KnowledgeAssetReferenceOption } from '~/editor/knowledge-asset-reference'
import { createKnowledgeAssetReferencePlugins } from '~/editor/knowledge-asset-reference'
import {
  findInlineAssetSlashMatch,
  matchesInlineAssetSlashQuery,
} from '~/editor/inline-asset-slash'
import { createKnowledgeReferenceToken } from '~/editor/knowledge-reference-syntax'

const props = defineProps<{
  modelValue: string
  references: KnowledgeAssetReferenceOption[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorRoot = ref<HTMLDivElement | null>(null)
const inlineMenuRoot = ref<HTMLDivElement | null>(null)
let editor: Crepe | null = null
let editorReady: Promise<unknown> | null = null
let unmounted = false

type InlineMenuState = {
  from: number
  to: number
  left: number
  top: number
}

const inlineMenu = ref<InlineMenuState | null>(null)
const inlineMenuQuery = ref('')
const inlineMenuActiveIndex = ref(0)
const inlineMenuOptions = computed(() => props.references.filter(option => (
  matchesInlineAssetSlashQuery(option, inlineMenuQuery.value)
)))

const closeInlineMenu = () => {
  inlineMenu.value = null
  inlineMenuQuery.value = ''
  inlineMenuActiveIndex.value = 0
}

const updateInlineMenu = (view: EditorView) => {
  const { selection } = view.state
  if (!(selection instanceof TextSelection) || !selection.empty) {
    closeInlineMenu()
    return
  }

  const { $from } = selection
  if (!['paragraph', 'heading'].includes($from.parent.type.name)) {
    closeInlineMenu()
    return
  }

  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, undefined, '\uFFFC')
  const match = findInlineAssetSlashMatch(textBeforeCursor)
  if (!match) {
    closeInlineMenu()
    return
  }

  const coordinates = view.coordsAtPos(selection.from)
  const menuWidth = Math.min(360, window.innerWidth - 24)
  inlineMenu.value = {
    from: $from.start() + match.slashOffset,
    to: selection.from,
    left: Math.max(12, Math.min(coordinates.left, window.innerWidth - menuWidth - 12)),
    top: coordinates.bottom + 8,
  }
  inlineMenuQuery.value = match.query
  inlineMenuActiveIndex.value = Math.min(
    inlineMenuActiveIndex.value,
    Math.max(0, inlineMenuOptions.value.length - 1),
  )
}

const insertInlineAssetReference = (
  view: EditorView,
  option: KnowledgeAssetReferenceOption,
) => {
  const menu = inlineMenu.value
  const referenceNode = view.state.schema.nodes.assetReference
  if (!menu || !referenceNode) return

  const raw = createKnowledgeReferenceToken(option.targetType, option.recordId)
  const node = referenceNode.create({
    assetType: option.targetType,
    recordId: option.recordId,
    raw,
  })
  closeInlineMenu()
  view.dispatch(view.state.tr.replaceWith(menu.from, menu.to, node).scrollIntoView())
  view.focus()
}

const selectInlineMenuOption = (option: KnowledgeAssetReferenceOption) => {
  editor?.editor.action(ctx => insertInlineAssetReference(ctx.get(editorViewCtx), option))
}

const createInlineAssetSlashMenuPlugin = () => $prose(() => new Plugin({
  props: {
    handleKeyDown: (view, event) => {
      if (!inlineMenu.value) return false

      if (event.key === 'Escape') {
        event.preventDefault()
        closeInlineMenu()
        return true
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const direction = event.key === 'ArrowDown' ? 1 : -1
        const lastIndex = inlineMenuOptions.value.length - 1
        inlineMenuActiveIndex.value = Math.max(
          0,
          Math.min(lastIndex, inlineMenuActiveIndex.value + direction),
        )
        void nextTick(() => {
          inlineMenuRoot.value
            ?.querySelector<HTMLElement>('[aria-selected="true"]')
            ?.scrollIntoView({ block: 'nearest' })
        })
        return true
      }

      if (event.key === 'Enter') {
        const option = inlineMenuOptions.value[inlineMenuActiveIndex.value]
        if (!option) return false
        event.preventDefault()
        insertInlineAssetReference(view, option)
        return true
      }

      return false
    },
  },
  view: view => ({
    update: updateInlineMenu,
    destroy: closeInlineMenu,
  }),
}))

const toolbarLabels = [
  '加粗',
  '斜体',
  '删除线',
  '行内代码',
  '无序列表',
  '有序列表',
  '任务列表',
  '链接',
  '表格',
  '代码块',
  '公式',
  '引用',
  '分隔线',
]

const applyEditorAccessibilityLabels = () => {
  const root = editorRoot.value
  if (!root) return

  const headingButton = root.querySelector<HTMLButtonElement>('.top-bar-heading-button')
  headingButton?.setAttribute('aria-label', '文本样式')
  headingButton?.setAttribute('title', '文本样式')

  root.querySelectorAll<HTMLButtonElement>('.top-bar-item').forEach((button, index) => {
    const label = toolbarLabels[index]
    if (!label) return
    button.setAttribute('aria-label', label)
    button.setAttribute('title', label)
  })

  root.querySelector<HTMLElement>('.ProseMirror')?.setAttribute('aria-label', 'Markdown 正文')
}

const assetReferenceIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path d="M12 2.75 20 7.1v9.8l-8 4.35-8-4.35V7.1l8-4.35Zm0 1.9L6.2 7.8l5.8 3.15 5.8-3.15L12 4.65ZM5.5 9.1v6.95l5.75 3.12v-6.94L5.5 9.1Zm7.25 10.07 5.75-3.12V9.1l-5.75 3.13v6.94Z" />
  </svg>
`

const insertAssetReferenceFromSlashMenu = (
  ctx: Ctx,
  option: KnowledgeAssetReferenceOption,
) => {
  const view = ctx.get(editorViewCtx)
  const referenceNode = view.state.schema.nodes.assetReference
  if (!referenceNode) return

  const commands = ctx.get(commandsCtx)
  commands.call(clearTextInCurrentBlockCommand.key)

  const raw = createKnowledgeReferenceToken(option.targetType, option.recordId)
  const node = referenceNode.create({
    assetType: option.targetType,
    recordId: option.recordId,
    raw,
  })
  view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView())
  view.focus()
}

onMounted(() => {
  if (!editorRoot.value) return

  const instance = new Crepe({
    root: editorRoot.value,
    defaultValue: props.modelValue,
    features: {
      [Crepe.Feature.ImageBlock]: false,
      [Crepe.Feature.TopBar]: true,
    },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: {
        text: '输入 Markdown，或输入 / 引用项目资产…',
        mode: 'doc',
      },
      [Crepe.Feature.TopBar]: {
        headingOptions: [
          { label: '正文', level: null },
          { label: '标题 1', level: 1 },
          { label: '标题 2', level: 2 },
          { label: '标题 3', level: 3 },
          { label: '标题 4', level: 4 },
          { label: '标题 5', level: 5 },
          { label: '标题 6', level: 6 },
        ],
      },
      [Crepe.Feature.CodeMirror]: {
        theme: [],
        searchPlaceholder: '搜索语言',
        noResultText: '没有匹配的语言',
        copyText: '复制',
        previewToggleText: previewOnlyMode => previewOnlyMode ? '编辑' : '隐藏预览',
      },
      [Crepe.Feature.BlockEdit]: {
        textGroup: {
          label: '文本',
          text: { label: '正文' },
          h1: { label: '标题 1' },
          h2: { label: '标题 2' },
          h3: { label: '标题 3' },
          h4: { label: '标题 4' },
          h5: { label: '标题 5' },
          h6: { label: '标题 6' },
          quote: { label: '引用' },
          divider: { label: '分隔线' },
        },
        listGroup: {
          label: '列表',
          bulletList: { label: '无序列表' },
          orderedList: { label: '有序列表' },
          taskList: { label: '任务列表' },
        },
        advancedGroup: {
          label: '高级内容',
          codeBlock: { label: '代码块' },
          table: { label: '表格' },
          math: { label: '公式' },
        },
        buildMenu: (builder) => {
          const group = builder.addGroup('asset-reference', '资产引用')

          if (!props.references.length) {
            group.addItem('asset-reference-empty', {
              label: '暂无可引用资产',
              icon: assetReferenceIcon,
              onRun: ctx => ctx.get(editorViewCtx).focus(),
            })
            return
          }

          props.references.forEach((option) => {
            group.addItem(`asset-reference-${option.targetType}-${option.recordId}`, {
              label: `${option.typeLabel}：${option.label}`,
              icon: assetReferenceIcon,
              onRun: ctx => insertAssetReferenceFromSlashMenu(ctx, option),
            })
          })
        },
      },
    },
  })
  instance.editor.use(createKnowledgeAssetReferencePlugins(props.references))
  instance.editor.use(createInlineAssetSlashMenuPlugin())
  instance.on(listener => listener.markdownUpdated((_ctx, markdown) => {
    if (markdown !== props.modelValue) emit('update:modelValue', markdown)
  }))
  editor = instance
  editorReady = instance.create().then(async () => {
    if (unmounted) return instance.destroy()
    await nextTick()
    applyEditorAccessibilityLabels()
  })
})

watch(() => props.modelValue, (value) => {
  if (!editor || !editorReady) return
  void editorReady.then(() => {
    if (editor && editor.getMarkdown() !== value) editor.editor.action(replaceAll(value))
  })
})

onBeforeUnmount(() => {
  unmounted = true
  closeInlineMenu()
  if (editor) void editor.destroy()
})

const getMarkdown = () => editor?.getMarkdown() ?? props.modelValue

defineExpose({ getMarkdown })
</script>

<template>
  <div class="knowledge-markdown-editor">
    <div ref="editorRoot" />
    <Teleport to="body">
      <div
        v-if="inlineMenu"
        ref="inlineMenuRoot"
        class="knowledge-inline-slash-menu"
        :style="{ left: `${inlineMenu.left}px`, top: `${inlineMenu.top}px` }"
        role="listbox"
        aria-label="快捷添加资产"
      >
        <header>
          <span>资产引用</span>
          <small v-if="inlineMenuQuery">“{{ inlineMenuQuery }}”</small>
        </header>
        <div v-if="inlineMenuOptions.length" class="knowledge-inline-slash-options">
          <button
            v-for="(option, index) in inlineMenuOptions"
            :key="`${option.targetType}-${option.recordId}`"
            type="button"
            role="option"
            :aria-selected="inlineMenuActiveIndex === index"
            @pointerenter="inlineMenuActiveIndex = index"
            @pointerdown.prevent
            @click="selectInlineMenuOption(option)"
          >
            <span>{{ option.typeLabel }}</span>
            <strong>{{ option.label }}</strong>
            <small>{{ option.detail }}</small>
          </button>
        </div>
        <p v-else>{{ props.references.length ? '没有匹配的资产' : '暂无可引用资产' }}</p>
      </div>
    </Teleport>
  </div>
</template>

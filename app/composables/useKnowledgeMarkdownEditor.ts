import { Crepe } from '@milkdown/crepe'
import type { Ctx, MilkdownPlugin } from '@milkdown/kit/ctx'
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core'
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark'
import type { EditorView } from '@milkdown/kit/prose/view'
import { replaceAll } from '@milkdown/kit/utils'
import type { Ref } from 'vue'
import type { KnowledgeAssetReferenceOption } from '~/editor/knowledge-asset-reference'
import { createKnowledgeAssetReferencePlugins } from '~/editor/knowledge-asset-reference'
import { createKnowledgeReferenceToken } from '~/editor/knowledge-reference-syntax'

type EditorOptions = {
  root: Ref<HTMLDivElement | null>
  modelValue: () => string
  references: () => KnowledgeAssetReferenceOption[]
  onUpdate: (markdown: string) => void
  inlineMenuPlugin: () => MilkdownPlugin
  insertInlineReference: (view: EditorView, option: KnowledgeAssetReferenceOption) => void
  closeInlineMenu: () => void
}

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

const assetReferenceIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path d="M12 2.75 20 7.1v9.8l-8 4.35-8-4.35V7.1l8-4.35Zm0 1.9L6.2 7.8l5.8 3.15 5.8-3.15L12 4.65ZM5.5 9.1v6.95l5.75 3.12v-6.94L5.5 9.1Zm7.25 10.07 5.75-3.12V9.1l-5.75 3.13v6.94Z" />
  </svg>
`

export const useKnowledgeMarkdownEditor = (options: EditorOptions) => {
  let editor: Crepe | null = null
  let editorReady: Promise<unknown> | null = null
  let unmounted = false

  const applyAccessibilityLabels = () => {
    const root = options.root.value
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

  const insertFromSlashMenu = (ctx: Ctx, option: KnowledgeAssetReferenceOption) => {
    const view = ctx.get(editorViewCtx)
    const referenceNode = view.state.schema.nodes.assetReference
    if (!referenceNode) return
    ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key)
    const raw = createKnowledgeReferenceToken(option.targetType, option.recordId)
    const node = referenceNode.create({ assetType: option.targetType, recordId: option.recordId, raw })
    view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView())
    view.focus()
  }

  onMounted(() => {
    if (!options.root.value) return
    const instance = new Crepe({
      root: options.root.value,
      defaultValue: options.modelValue(),
      features: {
        [Crepe.Feature.ImageBlock]: false,
        [Crepe.Feature.TopBar]: true,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: '输入 Markdown，或输入 / 引用项目资产…', mode: 'doc' },
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
            if (!options.references().length) {
              group.addItem('asset-reference-empty', { label: '暂无可引用资产', icon: assetReferenceIcon, onRun: ctx => ctx.get(editorViewCtx).focus() })
              return
            }
            options.references().forEach((option) => {
              group.addItem(`asset-reference-${option.targetType}-${option.recordId}`, {
                label: `${option.typeLabel}：${option.label}`,
                icon: assetReferenceIcon,
                onRun: ctx => insertFromSlashMenu(ctx, option),
              })
            })
          },
        },
      },
    })
    instance.editor.use(createKnowledgeAssetReferencePlugins(options.references()))
    instance.editor.use(options.inlineMenuPlugin())
    instance.on(listener => listener.markdownUpdated((_ctx, markdown) => {
      if (markdown !== options.modelValue()) options.onUpdate(markdown)
    }))
    editor = instance
    editorReady = instance.create().then(async () => {
      if (unmounted) return instance.destroy()
      await nextTick()
      applyAccessibilityLabels()
    })
  })

  watch(options.modelValue, (value) => {
    if (!editor || !editorReady) return
    void editorReady.then(() => {
      if (editor && editor.getMarkdown() !== value) editor.editor.action(replaceAll(value))
    })
  })

  onBeforeUnmount(() => {
    unmounted = true
    options.closeInlineMenu()
    if (editor) void editor.destroy()
  })

  const selectInlineReference = (option: KnowledgeAssetReferenceOption) => {
    editor?.editor.action(ctx => options.insertInlineReference(ctx.get(editorViewCtx), option))
  }
  const getMarkdown = () => editor?.getMarkdown() ?? options.modelValue()

  return { getMarkdown, selectInlineReference }
}

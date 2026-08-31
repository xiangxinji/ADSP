<script setup lang="ts">
import { Crepe } from '@milkdown/crepe'
import type { Ctx } from '@milkdown/kit/ctx'
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core'
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark'
import { replaceAll } from '@milkdown/kit/utils'
import type { KnowledgeAssetReferenceOption } from '~/editor/knowledge-asset-reference'
import { createKnowledgeAssetReferencePlugins } from '~/editor/knowledge-asset-reference'
import { createKnowledgeReferenceToken } from '~/editor/knowledge-reference-syntax'

const props = defineProps<{
  modelValue: string
  references: KnowledgeAssetReferenceOption[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorRoot = ref<HTMLDivElement | null>(null)
let editor: Crepe | null = null
let editorReady: Promise<unknown> | null = null
let unmounted = false

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

const knowledgeReferenceIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path d="M6 3.75h9.25A2.75 2.75 0 0 1 18 6.5v13.75H7.5A3.5 3.5 0 0 1 4 16.75V5.75A2 2 0 0 1 6 3.75Zm-.5 12.92v.08a2 2 0 0 0 2 2h9V17h-9c-.74 0-1.43-.12-2-.33ZM7 7h8v1.5H7V7Zm0 3.5h6v1.5H7v-1.5Z" />
  </svg>
`

const insertKnowledgeReferenceFromSlashMenu = (
  ctx: Ctx,
  option: KnowledgeAssetReferenceOption,
) => {
  const view = ctx.get(editorViewCtx)
  const referenceNode = view.state.schema.nodes.assetReference
  if (!referenceNode) return

  const commands = ctx.get(commandsCtx)
  commands.call(clearTextInCurrentBlockCommand.key)

  const raw = createKnowledgeReferenceToken(option.assetType, option.recordId)
  const node = referenceNode.create({
    assetType: option.assetType,
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
        text: '输入 Markdown，或输入 / 引用其他知识…',
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
          const knowledgeOptions = props.references.filter(option => option.targetType === 'knowledge')
          const group = builder.addGroup('knowledge-reference', '知识引用')

          if (!knowledgeOptions.length) {
            group.addItem('knowledge-reference-empty', {
              label: '暂无其他可引用知识',
              icon: knowledgeReferenceIcon,
              onRun: ctx => ctx.get(editorViewCtx).focus(),
            })
            return
          }

          knowledgeOptions.forEach((option) => {
            group.addItem(`knowledge-reference-${option.recordId}`, {
              label: `引用知识：${option.label}`,
              icon: knowledgeReferenceIcon,
              onRun: ctx => insertKnowledgeReferenceFromSlashMenu(ctx, option),
            })
          })
        },
      },
    },
  })
  instance.editor.use(createKnowledgeAssetReferencePlugins(props.references))
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
  if (editor) void editor.destroy()
})

const getMarkdown = () => editor?.getMarkdown() ?? props.modelValue

defineExpose({ getMarkdown })
</script>

<template>
  <div class="knowledge-markdown-editor">
    <div ref="editorRoot" />
  </div>
</template>

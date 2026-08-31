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
      [Crepe.Feature.BlockEdit]: {
        buildMenu: (builder) => {
          const knowledgeOptions = props.references.filter(option => option.targetType === 'knowledge')
          if (!knowledgeOptions.length) return

          const group = builder.addGroup('knowledge-reference', '知识引用')
          knowledgeOptions.forEach((option) => {
            group.addItem(`knowledge-reference-${option.recordId}`, {
              label: `引用知识 · ${option.label}`,
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
  editorReady = instance.create().then(() => {
    if (unmounted) return instance.destroy()
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

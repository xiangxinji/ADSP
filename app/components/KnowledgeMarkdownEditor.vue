<script setup lang="ts">
import { Crepe } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/kit/core'
import { insert, replaceAll } from '@milkdown/kit/utils'
import type { KnowledgeAssetReferenceOption } from '~/editor/knowledge-asset-reference'
import { createKnowledgeAssetReferencePlugins } from '~/editor/knowledge-asset-reference'

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
        text: '输入 Markdown，或插入项目资产引用…',
        mode: 'doc',
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

const insertReference = async (assetType: string, recordId: string) => {
  await editorReady
  if (!editor) return
  editor.editor.action(insert(`[[${assetType}：${recordId}]]`, true))
  editor.editor.action(ctx => ctx.get(editorViewCtx).focus())
}

const getMarkdown = () => editor?.getMarkdown() ?? props.modelValue

defineExpose({ getMarkdown, insertReference })
</script>

<template>
  <div class="knowledge-markdown-editor">
    <div ref="editorRoot" />
  </div>
</template>

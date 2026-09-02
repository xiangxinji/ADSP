<script setup lang="ts">
import type { KnowledgeAssetReferenceOption } from '~/editor/knowledge-asset-reference'

type InlineMenuHandle = { scrollActiveIntoView: () => void }

const props = defineProps<{
  modelValue: string
  references: KnowledgeAssetReferenceOption[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const editorRoot = ref<HTMLDivElement | null>(null)
const inlineMenuComponent = ref<InlineMenuHandle | null>(null)
const slashMenu = useInlineAssetSlashMenu(
  () => props.references,
  () => inlineMenuComponent.value?.scrollActiveIntoView(),
)
const { menu, query, activeIndex, options } = slashMenu
const editor = useKnowledgeMarkdownEditor({
  root: editorRoot,
  modelValue: () => props.modelValue,
  references: () => props.references,
  onUpdate: value => emit('update:modelValue', value),
  inlineMenuPlugin: slashMenu.plugin,
  insertInlineReference: slashMenu.insert,
  closeInlineMenu: slashMenu.close,
})

defineExpose({ getMarkdown: editor.getMarkdown })
</script>

<template>
  <div class="knowledge-markdown-editor"><div ref="editorRoot" /></div>
  <KnowledgeInlineAssetMenu
    ref="inlineMenuComponent"
    :menu="menu"
    :query="query"
    :options="options"
    :active-index="activeIndex"
    :has-references="Boolean(references.length)"
    @update:active-index="activeIndex = $event"
    @select="editor.selectInlineReference"
  />
</template>

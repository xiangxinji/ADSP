<script setup lang="ts">
import type { AppIconName } from '~/types/ui'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  overline?: string
  closeLabel?: string
  busy?: boolean
  descriptionId?: string
  icon?: AppIconName
}>(), {
  overline: '',
  closeLabel: '关闭弹框',
  busy: false,
  descriptionId: undefined,
  icon: undefined,
})

const emit = defineEmits<{
  requestClose: [reason: 'button' | 'escape']
}>()

const dialogElement = ref<HTMLElement | null>(null)
const titleId = useId()
let previousFocus: HTMLElement | null = null
let layerLocked = false

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const focusableElements = () => Array.from(dialogElement.value?.querySelectorAll<HTMLElement>(focusableSelector) || [])
  .filter(element => element.getAttribute('aria-hidden') !== 'true' && element.offsetParent !== null)

const lockBackground = () => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  lockDialogLayer()
  layerLocked = true
}

const unlockBackground = () => {
  const restoreTarget = layerLocked ? unlockDialogLayer(previousFocus) : null
  layerLocked = false
  previousFocus = null
  nextTick(() => {
    if (restoreTarget?.isConnected) restoreTarget.focus()
  })
}

const focusDialog = () => {
  const autofocusElement = dialogElement.value?.querySelector<HTMLElement>('[autofocus]')
  const firstElement = autofocusElement || focusableElements()[0] || dialogElement.value
  firstElement?.focus()
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && !props.busy) {
    event.preventDefault()
    emit('requestClose', 'escape')
    return
  }
  if (event.key !== 'Tab') return

  const elements = focusableElements()
  if (!elements.length) {
    event.preventDefault()
    dialogElement.value?.focus()
    return
  }

  const firstElement = elements[0]
  const lastElement = elements.at(-1)
  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement?.focus()
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

watch(() => props.open, async (open) => {
  if (!import.meta.client) return
  if (open) {
    lockBackground()
    await nextTick()
    focusDialog()
  } else if (layerLocked) {
    unlockBackground()
  }
}, { immediate: true, flush: 'sync' })

onBeforeUnmount(() => {
  if (import.meta.client && layerLocked) unlockBackground()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" @pointerdown.self.prevent>
      <section
        ref="dialogElement"
        v-bind="$attrs"
        class="dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="descriptionId"
        tabindex="-1"
        @keydown="onKeydown"
      >
        <header class="dialog-heading">
          <div class="dialog-title">
            <span v-if="icon" class="dialog-title-icon"><AppIcon :name="icon" :size="20" /></span>
            <div>
              <p v-if="overline" class="overline">{{ overline }}</p>
              <h2 :id="titleId">{{ title }}</h2>
            </div>
          </div>
          <AppButton variant="plain" class="close-button" icon="close" :icon-size="18" :aria-label="closeLabel" :disabled="busy" @click="emit('requestClose', 'button')" />
        </header>
        <div class="dialog-body">
          <slot />
        </div>
        <footer v-if="$slots.actions" class="dialog-actions">
          <slot name="actions" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { AppButtonVariant, AppIconName } from '~/types/ui'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  variant?: AppButtonVariant
  type?: 'button' | 'submit' | 'reset'
  icon?: AppIconName
  trailingIcon?: AppIconName
  iconSize?: number
  busy?: boolean
  busyLabel?: string
  disabled?: boolean
  to?: string
}>(), {
  variant: 'primary',
  type: 'button',
  icon: undefined,
  trailingIcon: undefined,
  iconSize: 16,
  busy: false,
  busyLabel: '',
  disabled: false,
  to: undefined,
})

const classes = computed(() => {
  if (props.variant === 'plain') return []
  if (props.variant === 'text-danger') return ['text-button', 'danger']
  if (props.variant === 'text') return ['text-button']
  return ['button', props.variant]
})
</script>

<template>
  <NuxtLink v-if="to" v-bind="$attrs" class="app-button" :class="classes" :to="to">
    <AppIcon v-if="icon" :name="icon" :size="iconSize" />
    <slot />
    <AppIcon v-if="trailingIcon" :name="trailingIcon" :size="iconSize" />
  </NuxtLink>
  <button
    v-else
    v-bind="$attrs"
    class="app-button"
    :class="classes"
    :type="type"
    :disabled="disabled || busy"
    :aria-busy="busy || undefined"
  >
    <AppIcon v-if="icon" :name="icon" :size="iconSize" />
    <template v-if="busy && busyLabel">{{ busyLabel }}</template>
    <slot v-else />
    <AppIcon v-if="trailingIcon" :name="trailingIcon" :size="iconSize" />
  </button>
</template>

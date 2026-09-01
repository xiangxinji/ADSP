<script setup lang="ts">
import type { AppButtonVariant, AppControlSize, AppIconName } from '~/types/ui'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  variant?: AppButtonVariant
  size?: AppControlSize
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
  size: undefined,
  type: 'button',
  icon: undefined,
  trailingIcon: undefined,
  iconSize: undefined,
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

const resolvedSize = computed<AppControlSize>(() => {
  if (props.size) return props.size
  return ['plain', 'text', 'text-danger'].includes(props.variant) ? 'sm' : 'md'
})

const resolvedIconSize = computed(() => props.iconSize ?? ({ sm: 12, md: 16, lg: 20 } as const)[resolvedSize.value])
</script>

<template>
  <NuxtLink v-if="to" v-bind="$attrs" class="app-button" :class="classes" :data-size="resolvedSize" :to="to">
    <AppIcon v-if="icon" :name="icon" :size="resolvedIconSize" />
    <slot />
    <AppIcon v-if="trailingIcon" :name="trailingIcon" :size="resolvedIconSize" />
  </NuxtLink>
  <button
    v-else
    v-bind="$attrs"
    class="app-button"
    :class="classes"
    :data-size="resolvedSize"
    :type="type"
    :disabled="disabled || busy"
    :aria-busy="busy || undefined"
  >
    <AppIcon v-if="icon" :name="icon" :size="resolvedIconSize" />
    <template v-if="busy && busyLabel">{{ busyLabel }}</template>
    <slot v-else />
    <AppIcon v-if="trailingIcon" :name="trailingIcon" :size="resolvedIconSize" />
  </button>
</template>

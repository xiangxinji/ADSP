<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  danger?: boolean
}>(), {
  confirmLabel: '确认',
  cancelLabel: '取消',
  busy: false,
  danger: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const descriptionId = useId()
</script>

<template>
  <AppDialog
    :open="open"
    :title="title"
    overline="CONFIRM ACTION"
    icon="alert"
    class="confirm-dialog"
    :busy="busy"
    :description-id="descriptionId"
    @request-close="emit('cancel')"
  >
    <p :id="descriptionId" class="confirm-description">{{ description }}</p>
    <template #actions>
      <button class="button secondary" type="button" :disabled="busy" @click="emit('cancel')">{{ cancelLabel }}</button>
      <button class="button" :class="danger ? 'danger' : 'primary'" type="button" :disabled="busy" @click="emit('confirm')">
        {{ busy ? '处理中…' : confirmLabel }}
      </button>
    </template>
  </AppDialog>
</template>

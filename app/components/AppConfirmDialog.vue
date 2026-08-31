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
      <AppButton variant="secondary" :disabled="busy" @click="emit('cancel')">{{ cancelLabel }}</AppButton>
      <AppButton :variant="danger ? 'danger' : 'primary'" :busy="busy" busy-label="处理中…" :icon="danger ? 'delete' : 'check'" @click="emit('confirm')">{{ confirmLabel }}</AppButton>
    </template>
  </AppDialog>
</template>

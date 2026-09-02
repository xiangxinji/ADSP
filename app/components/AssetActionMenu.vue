<script setup lang="ts">
import { primaryAssetOperationLimit } from '#shared/config/asset-operations'
import type { AssetOperationDefinition } from '#shared/types/asset-operations'

const props = withDefaults(defineProps<{
  operations: readonly AssetOperationDefinition[]
  busyOperationId?: string | null
  disabled?: boolean
  operationTo?: (operation: AssetOperationDefinition) => string | undefined
}>(), {
  busyOperationId: null,
  disabled: false,
  operationTo: undefined,
})

const emit = defineEmits<{
  select: [operation: AssetOperationDefinition]
}>()

const menuRoot = ref<HTMLElement | null>(null)
const menuOpen = ref(false)
const primaryOperations = computed(() => props.operations
  .filter(operation => operation.placement === 'primary')
  .slice(0, primaryAssetOperationLimit))
const primaryOperationIds = computed(() => new Set(primaryOperations.value.map(operation => operation.id)))
const moreOperations = computed(() => props.operations
  .filter(operation => !primaryOperationIds.value.has(operation.id)))

const isBusy = (operation: AssetOperationDefinition) => props.busyOperationId === operation.id
const isDisabled = (operation: AssetOperationDefinition) => props.disabled || Boolean(props.busyOperationId)
const selectOperation = (operation: AssetOperationDefinition) => {
  menuOpen.value = false
  emit('select', operation)
}
const closeOnOutsidePointer = (event: PointerEvent) => {
  if (!menuRoot.value?.contains(event.target as Node)) menuOpen.value = false
}

onMounted(() => document.addEventListener('pointerdown', closeOnOutsidePointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutsidePointer))
</script>

<template>
  <div class="asset-action-menu">
    <AppButton
      v-for="operation in primaryOperations"
      :key="operation.id"
      :variant="operation.danger ? 'text-danger' : 'text'"
      :icon="operation.icon"
      :busy="isBusy(operation)"
      :busy-label="`${operation.label}中…`"
      :disabled="isDisabled(operation)"
      :to="operationTo?.(operation)"
      @click="selectOperation(operation)"
    >{{ operation.label }}</AppButton>

    <div v-if="moreOperations.length" ref="menuRoot" class="asset-action-more" @keydown.esc="menuOpen = false">
      <AppButton
        variant="text"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        :disabled="disabled || Boolean(busyOperationId)"
        @click="menuOpen = !menuOpen"
      >更多</AppButton>
      <div v-if="menuOpen" class="asset-action-more-menu" role="menu" aria-label="更多操作">
        <AppButton
          v-for="operation in moreOperations"
          :key="operation.id"
          :variant="operation.danger ? 'text-danger' : 'text'"
          :icon="operation.icon"
          :busy="isBusy(operation)"
          :busy-label="`${operation.label}中…`"
          :disabled="isDisabled(operation)"
          :to="operationTo?.(operation)"
          role="menuitem"
          @click="selectOperation(operation)"
        >{{ operation.label }}</AppButton>
      </div>
    </div>
  </div>
</template>

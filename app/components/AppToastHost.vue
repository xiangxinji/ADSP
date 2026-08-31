<script setup lang="ts">
const { toast, dismiss } = useAppToast()
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <aside
        v-if="toast"
        class="app-toast"
        :class="`app-toast-${toast.tone}`"
        :role="toast.tone === 'error' ? 'alert' : 'status'"
        :aria-live="toast.tone === 'error' ? 'assertive' : 'polite'"
      >
        <span class="app-toast-icon"><AppIcon :name="toast.tone === 'error' ? 'alert' : 'check'" :size="18" /></span>
        <span>{{ toast.message }}</span>
        <AppButton variant="plain" icon="close" aria-label="关闭提示" @click="dismiss" />
      </aside>
    </Transition>
  </Teleport>
</template>

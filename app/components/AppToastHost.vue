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
        <button type="button" aria-label="关闭提示" @click="dismiss"><AppIcon name="close" :size="16" /></button>
      </aside>
    </Transition>
  </Teleport>
</template>

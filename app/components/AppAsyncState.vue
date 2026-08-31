<script setup lang="ts">
withDefaults(defineProps<{
  pending?: boolean
  errorMessage?: string
}>(), {
  pending: false,
  errorMessage: '',
})

defineEmits<{
  retry: []
}>()
</script>

<template>
  <section class="panel async-state" :aria-busy="pending">
    <template v-if="pending">
      <span class="async-spinner" aria-hidden="true" />
      <strong>正在读取数据</strong>
      <span>请稍候，ForgePilot 正在同步当前内容。</span>
    </template>
    <template v-else>
      <span class="async-error-icon"><AppIcon name="alert" :size="20" /></span>
      <strong>暂时无法读取数据</strong>
      <span>{{ errorMessage || '请求失败，请稍后重试。' }}</span>
      <button class="button secondary" type="button" @click="$emit('retry')">重新加载</button>
    </template>
  </section>
</template>

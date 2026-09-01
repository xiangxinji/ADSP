<script setup lang="ts">
const { preference, resolvedMode } = useColorMode()

useHead({
  htmlAttrs: {
    lang: 'zh-CN',
    'data-theme': preference,
  },
  title: 'ForgePilot · 铸航',
  meta: [
    { name: 'description', content: 'ForgePilot 是从需求到交付的自主软件交付平台。' },
    { name: 'theme-color', content: computed(() => resolvedMode.value === 'dark' ? '#0b1120' : '#f7f8fa') },
  ],
})
</script>

<template>
  <div>
    <a class="skip-link" href="#main-content">跳转到主要内容</a>
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <AppToastHost />
  </div>
</template>

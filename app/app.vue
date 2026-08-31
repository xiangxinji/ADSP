<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'zh-CN' },
  title: 'ForgePilot · 铸航',
  meta: [
    { name: 'description', content: 'ForgePilot 是从需求到交付的自主软件交付平台。' },
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

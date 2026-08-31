<script setup lang="ts">
defineProps<{
  badge?: string
}>()

const route = useRoute()
const activeSection = computed(() => {
  if (route.path === '/users') return 'users'
  if (route.path === '/settings') return 'settings'
  return 'projects'
})
</script>

<template>
  <header class="site-header">
    <NuxtLink to="/" class="brand">
      <span>ForgePilot</span>
      <small>铸航 · Autonomous Software Delivery</small>
    </NuxtLink>
    <nav class="header-nav" aria-label="全局导航">
      <NuxtLink to="/" :class="{ active: activeSection === 'projects' }" :aria-current="activeSection === 'projects' ? 'page' : undefined">项目</NuxtLink>
      <NuxtLink to="/users" :class="{ active: activeSection === 'users' }" :aria-current="activeSection === 'users' ? 'page' : undefined">用户管理</NuxtLink>
      <NuxtLink to="/settings" :class="{ active: activeSection === 'settings' }" :aria-current="activeSection === 'settings' ? 'page' : undefined">全局设置</NuxtLink>
    </nav>
    <span v-if="badge" class="header-badge">{{ badge }}</span>
  </header>
</template>

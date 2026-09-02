<script setup lang="ts">
import GitLabSettingsPanel from '~/components/settings/GitLabSettingsPanel.vue'
import LocalWorkspaceSettingsPanel from '~/components/settings/LocalWorkspaceSettingsPanel.vue'
</script>

<template>
  <div class="app-frame">
    <AppHeader />
    <main id="main-content" class="page settings-page">
      <section class="page-title-row">
        <div><p class="overline">GLOBAL SETTINGS</p><h1>全局设置</h1><p>管理 ForgePilot 的本地工作目录和外部系统连接。</p></div>
      </section>
      <LocalWorkspaceSettingsPanel />
      <GitLabSettingsPanel />
    </main>
  </div>
</template>

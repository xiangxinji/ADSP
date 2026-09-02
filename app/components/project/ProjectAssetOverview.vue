<script setup lang="ts">
import type { ProjectWorkspace } from '#shared/types/asdp'

const props = defineProps<{ workspace: ProjectWorkspace }>()
const assetsPath = computed(() => `/projects/${props.workspace.project.id}/assets`)
</script>

<template>
  <section class="module-section assets-module">
    <div class="section-heading">
      <div><h2>资产管理</h2><p>按资产类型进入独立空间，查看和维护当前项目的交付资源。</p></div>
    </div>
    <div class="asset-module-grid">
      <NuxtLink class="panel asset-module-card" :to="`${assetsPath}/repositories`">
        <span class="asset-module-icon repository-icon"><AppIcon name="repository" :size="22" /></span>
        <span class="asset-module-copy"><strong>代码仓库</strong><small>管理 GitLab、GitHub 仓库连接</small></span>
        <span class="asset-module-meta"><strong>{{ workspace.repositories.length }}</strong><small>个仓库</small></span>
      </NuxtLink>
      <NuxtLink class="panel asset-module-card" :to="`${assetsPath}/members`">
        <span class="asset-module-icon member-icon"><AppIcon name="members" :size="22" /></span>
        <span class="asset-module-copy"><strong>项目成员</strong><small>从全局用户中选择成员并设置项目角色</small></span>
        <span class="asset-module-meta"><strong>{{ workspace.members.length }}</strong><small>位成员</small></span>
      </NuxtLink>
      <NuxtLink class="panel asset-module-card" :to="`${assetsPath}/environments`">
        <span class="asset-module-icon environment-icon"><AppIcon name="environment" :size="22" /></span>
        <span class="asset-module-copy"><strong>环境管理</strong><small>维护开发、测试和生产环境的访问入口</small></span>
        <span class="asset-module-meta"><strong>{{ workspace.environments.length }}</strong><small>个环境</small></span>
      </NuxtLink>
      <NuxtLink class="panel asset-module-card" :to="`${assetsPath}/knowledge`">
        <span class="asset-module-icon knowledge-icon"><AppIcon name="knowledge" :size="22" /></span>
        <span class="asset-module-copy"><strong>知识</strong><small>用 Markdown 沉淀项目知识，并引用项目内其他资产</small></span>
        <span class="asset-module-meta"><strong>{{ workspace.knowledge.length }}</strong><small>篇文档</small></span>
      </NuxtLink>
    </div>
    <aside class="asset-security-note"><span><AppIcon name="shield-check" :size="16" /></span><p><strong>测试账号可选</strong>如登记测试账号，ForgePilot 会保存并明文展示账号密码；请勿登记生产凭据、Token 或私钥。</p></aside>
  </section>
</template>

<script setup lang="ts">
import type { AssetModuleId } from '#shared/types/asset-operations'
import type { ProjectWorkspace } from '#shared/types/asdp'

const props = defineProps<{
  workspace: ProjectWorkspace
  activeTab: 'requirements' | 'assets'
  activeAssetModule: AssetModuleId | null
}>()

const projectPath = computed(() => `/projects/${props.workspace.project.id}`)
const assetsPath = computed(() => `${projectPath.value}/assets`)
const requirementsPath = computed(() => `${projectPath.value}/requirements`)
const assetModuleLabel = computed(() => ({
  repositories: '代码仓库',
  members: '项目成员',
  environments: '环境管理',
  knowledge: '知识',
})[props.activeAssetModule || 'repositories'])
</script>

<template>
  <nav class="breadcrumbs" aria-label="当前位置">
    <NuxtLink to="/">项目</NuxtLink><span aria-hidden="true">/</span>
    <NuxtLink :to="projectPath">{{ workspace.project.name }}</NuxtLink><span aria-hidden="true">/</span>
    <span v-if="activeTab === 'requirements'" aria-current="page">需求</span>
    <template v-else>
      <NuxtLink v-if="activeAssetModule" :to="assetsPath">资产</NuxtLink>
      <span v-else aria-current="page">资产</span>
      <template v-if="activeAssetModule">
        <span aria-hidden="true">/</span><span aria-current="page">{{ assetModuleLabel }}</span>
      </template>
    </template>
  </nav>

  <section class="workspace-heading">
    <div><p class="overline">PROJECT WORKSPACE</p><h1>{{ workspace.project.name }}</h1><p>{{ workspace.project.description || '暂无项目说明' }}</p></div>
    <div class="workspace-stats">
      <span><strong>{{ workspace.requirements.length }}</strong>需求</span>
      <span><strong>{{ workspace.requirementVersions.length }}</strong>版本</span>
      <span><strong>{{ workspace.repositories.length }}</strong>仓库</span>
      <span><strong>{{ workspace.members.length }}</strong>成员</span>
      <span><strong>{{ workspace.environments.length }}</strong>环境</span>
      <span><strong>{{ workspace.knowledge.length }}</strong>知识</span>
    </div>
  </section>

  <nav class="tabs" aria-label="项目模块">
    <NuxtLink :to="assetsPath" :class="{ active: activeTab === 'assets' }" :aria-current="activeTab === 'assets' ? 'page' : undefined">资产</NuxtLink>
    <NuxtLink :to="requirementsPath" :class="{ active: activeTab === 'requirements' }" :aria-current="activeTab === 'requirements' ? 'page' : undefined">需求</NuxtLink>
  </nav>
</template>

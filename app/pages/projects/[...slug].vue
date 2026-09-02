<script setup lang="ts">
import { assetModuleIds, type AssetModuleId } from '#shared/types/asset-operations'
import type { ProjectWorkspace } from '#shared/types/asdp'

const route = useRoute()
const routeSegments = computed(() => Array.isArray(route.params.slug)
  ? route.params.slug.map(segment => String(segment))
  : [String(route.params.slug || '')])
const projectId = computed(() => routeSegments.value[0])
const projectPath = computed(() => `/projects/${projectId.value}`)
const assetsPath = computed(() => `${projectPath.value}/assets`)
const requirementsPath = computed(() => `${projectPath.value}/requirements`)
const requestedSection = routeSegments.value[1]
const requestedModule = routeSegments.value[2]

if ((requestedSection && !['assets', 'requirements', 'workflows'].includes(requestedSection))
  || (requestedModule && (requestedSection !== 'assets' || !assetModuleIds.includes(requestedModule as AssetModuleId)))
  || routeSegments.value.length > 3) {
  throw createError({ statusCode: 404, statusMessage: '项目页面不存在' })
}

if (!requestedSection) {
  const legacyModule = String(route.query.asset || '')
  const modulePath = assetModuleIds.includes(legacyModule as AssetModuleId) ? `/${legacyModule}` : ''
  const defaultPath = route.query.tab === 'requirements' ? requirementsPath.value : `${assetsPath.value}${modulePath}`
  await navigateTo(defaultPath, { replace: true })
}

const { data: workspace, status, error, refresh } = await useFetch<ProjectWorkspace>(computed(() => `/api/projects/${projectId.value}`))
const activeTab = computed<'requirements' | 'assets' | 'workflows'>(() => {
  if (routeSegments.value[1] === 'requirements') return 'requirements'
  if (routeSegments.value[1] === 'workflows') return 'workflows'
  return 'assets'
})
const activeAssetModule = computed<AssetModuleId | null>(() => {
  const module = routeSegments.value[2] || ''
  return activeTab.value === 'assets' && assetModuleIds.includes(module as AssetModuleId) ? module as AssetModuleId : null
})
</script>

<template>
  <div class="app-frame">
    <AppHeader />
    <main v-if="workspace" id="main-content" class="page workspace-page" :class="{ 'asset-module-page': activeTab === 'assets' && activeAssetModule }">
      <ProjectWorkspaceHeader :workspace="workspace" :active-tab="activeTab" :active-asset-module="activeAssetModule" />
      <ProjectRequirementsPanel v-if="activeTab === 'requirements'" :workspace="workspace" :project-id="projectId" @refresh="refresh" />
      <ProjectWorkflowsPanel v-else-if="activeTab === 'workflows'" :workspace="workspace" :project-id="projectId" @refresh="refresh" />
      <ProjectAssetOverview v-else-if="!activeAssetModule" :workspace="workspace" />
      <ProjectRepositoryAssets v-else-if="activeAssetModule === 'repositories'" :workspace="workspace" :project-id="projectId" @refresh="refresh" />
      <ProjectMemberAssets v-else-if="activeAssetModule === 'members'" :workspace="workspace" :project-id="projectId" @refresh="refresh" />
      <ProjectEnvironmentAssets v-else-if="activeAssetModule === 'environments'" :workspace="workspace" :project-id="projectId" @refresh="refresh" />
      <ProjectKnowledgeAssets v-else :workspace="workspace" :project-id="projectId" @refresh="refresh" />
    </main>
    <main v-else id="main-content" class="page"><AppAsyncState :pending="status === 'pending'" :error-message="error?.statusMessage || '项目不存在'" @retry="refresh" /></main>
  </div>
</template>

<script setup lang="ts">
import { assetOperationsForModule } from '#shared/config/asset-operations'
import type { AssetOperationDefinition } from '#shared/types/asset-operations'
import type { EnvironmentAsset, EnvironmentType, ProjectWorkspace } from '#shared/types/asdp'

type DialogHandle = { open: (environment?: EnvironmentAsset) => void }

defineProps<{
  workspace: ProjectWorkspace
  projectId: string
}>()

const emit = defineEmits<{ refresh: [] }>()
const operations = assetOperationsForModule('environments')
const editor = ref<DialogHandle | null>(null)
const deletingEnvironment = ref<EnvironmentAsset | null>(null)
const deleting = ref(false)
const actionError = ref('')
const { success } = useAppToast()
const typeLabel = (type: EnvironmentType) => ({ development: '开发环境', testing: '测试环境', production: '生产环境' })[type]

const runOperation = (environment: EnvironmentAsset, operation: AssetOperationDefinition) => {
  if (operation.id === 'environment.edit') return editor.value?.open(environment)
  if (operation.id === 'environment.delete') deletingEnvironment.value = environment
}

const removeEnvironment = async () => {
  if (!deletingEnvironment.value) return
  const environment = deletingEnvironment.value
  deleting.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/environments/${environment.id}`, { method: 'DELETE' })
    deletingEnvironment.value = null
    emit('refresh')
    success(`“${environment.address}”已删除`)
  } catch (error: any) {
    actionError.value = error?.data?.statusMessage || error?.message || '操作失败'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="module-section assets-module">
    <div class="asset-detail-heading"><div class="section-heading"><div><p class="overline">ENVIRONMENT ASSETS</p><h2>环境管理</h2><p>维护项目开发、测试和生产环境的访问入口。</p></div><AppButton icon="add" @click="editor?.open()">添加环境</AppButton></div></div>
    <AssetOperationCatalog :operations="operations" />
    <p v-if="actionError" class="alert error-state" role="alert">{{ actionError }}</p>
    <div v-if="workspace.environments.length" class="asset-record-list" role="region" aria-label="项目环境列表" tabindex="0">
      <article v-for="environment in workspace.environments" :id="`asset-${environment.id}`" :key="environment.id" class="panel asset-card asset-record-card">
        <div class="asset-icon environment-icon"><AppIcon name="environment" :size="20" /></div>
        <div class="asset-copy">
          <strong>项目环境 <span class="provider-badge environment-badge" :data-environment="environment.type">{{ typeLabel(environment.type) }}</span></strong>
          <a :href="environment.address" target="_blank" rel="noreferrer">{{ environment.address }}</a>
          <span v-if="environment.note" class="asset-note">备注：{{ environment.note }}</span>
          <small v-for="account in environment.accounts" :key="account.account" class="environment-account">账号：{{ account.account }}　密码：{{ account.password || '未设置' }}</small>
        </div>
        <div class="asset-actions"><AssetActionMenu :operations="operations" @select="runOperation(environment, $event)" /></div>
      </article>
    </div>
    <div v-else class="panel empty-state"><strong>还没有项目环境</strong><span>登记环境地址，并可选择添加自助使用的测试账号。</span><AppButton icon="add" @click="editor?.open()">添加第一个环境</AppButton></div>
  </section>
  <ProjectEnvironmentDialog ref="editor" :project-id="projectId" @saved="emit('refresh')" />
  <AppConfirmDialog :open="Boolean(deletingEnvironment)" :title="`删除“${deletingEnvironment?.address || ''}”？`" description="删除后无法恢复。" confirm-label="确认删除" :busy="deleting" danger @cancel="deletingEnvironment = null" @confirm="removeEnvironment" />
</template>

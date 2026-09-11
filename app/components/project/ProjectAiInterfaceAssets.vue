<script setup lang="ts">
import { assetOperationsForModule } from '#shared/config/asset-operations'
import type { AssetOperationDefinition } from '#shared/types/asset-operations'
import type { AiInterfaceAsset } from '#shared/types/ai-interfaces'
import type { ProjectWorkspace } from '#shared/types/asdp'

defineProps<{ workspace: ProjectWorkspace, projectId: string }>()
const emit = defineEmits<{ refresh: [] }>()
const operations = assetOperationsForModule('ai-interfaces')
const editor = ref<{ open: (asset?: AiInterfaceAsset) => void } | null>(null)
const deletingAsset = ref<AiInterfaceAsset | null>(null)
const deleting = ref(false)
const actionError = ref('')
const { success } = useAppToast()

const runOperation = (asset: AiInterfaceAsset, operation: AssetOperationDefinition) => {
  if (operation.id === 'ai-interface.edit') editor.value?.open(asset)
  if (operation.id === 'ai-interface.delete') deletingAsset.value = asset
}

const removeAsset = async () => {
  if (!deletingAsset.value || deleting.value) return
  deleting.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/ai-interfaces/${deletingAsset.value.id}`, { method: 'DELETE' })
    deletingAsset.value = null
    emit('refresh')
    success('AI 接口已删除')
  } catch {
    actionError.value = '删除 AI 接口失败，请重试。'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="module-section assets-module">
    <div class="asset-detail-heading">
      <div class="section-heading">
        <div><p class="overline">AI INTERFACE ASSETS</p><h2>AI 接口</h2><p>集中管理当前项目使用的 AI 平台、接口名称和 API Key。</p></div>
        <AppButton icon="add" @click="editor?.open()">添加 AI 接口</AppButton>
      </div>
    </div>
    <AssetOperationCatalog :operations="operations" />
    <p v-if="actionError" class="alert error-state" role="alert">{{ actionError }}</p>
    <div v-if="workspace.aiInterfaces.length" class="asset-record-list" role="region" aria-label="项目 AI 接口列表" tabindex="0">
      <article v-for="asset in workspace.aiInterfaces" :id="`asset-${asset.id}`" :key="asset.id" class="panel asset-card asset-record-card">
        <div class="asset-icon knowledge-icon"><AppIcon name="ai" :size="20" /></div>
        <div class="asset-copy">
          <strong>{{ asset.name }} <span class="provider-badge">{{ asset.provider }}</span></strong>
          <span class="asset-note">API Key：{{ asset.hasApiKey ? '•••••••• · 已配置' : '未配置' }}</span>
          <small>密钥加密保存，不支持查看原文；可通过编辑替换。</small>
        </div>
        <div class="asset-actions"><AssetActionMenu :operations="operations" @select="runOperation(asset, $event)" /></div>
      </article>
    </div>
    <div v-else class="panel empty-state">
      <strong>还没有 AI 接口</strong>
      <span>添加 DeepSeek 等平台，填写接口名称和 API Key，即可保存为项目资产。</span>
      <AppButton icon="add" @click="editor?.open()">添加第一个 AI 接口</AppButton>
    </div>
    <aside class="asset-security-note">
      <span><AppIcon name="shield-check" :size="16" /></span>
      <p><strong>密钥不会回显</strong>这里只管理接口配置，不会调用 AI 平台或验证密钥有效性。</p>
    </aside>
  </section>
  <ProjectAiInterfaceDialog ref="editor" :project-id="projectId" @saved="emit('refresh')" />
  <AppConfirmDialog :open="Boolean(deletingAsset)" :title="`删除“${deletingAsset?.name || ''}”？`" description="接口及保存的密钥将被删除，知识文档中的引用会标记为失效。此操作不可恢复。" confirm-label="确认删除" :busy="deleting" danger @cancel="deletingAsset = null" @confirm="removeAsset" />
</template>

<script setup lang="ts">
import type { ProjectWorkspace, WorkflowOperationNode } from '#shared/types/asdp'
import { workflowAssetSource } from '#shared/utils/workflow-operation-assets'

const props = defineProps<{ node: WorkflowOperationNode, workspace: ProjectWorkspace }>()
const emit = defineEmits<{
  updateSource: [source: 'input' | 'fixed']
  updateAssetId: [assetId: string]
}>()
const source = computed(() => workflowAssetSource(props.node))
const assets = computed(() => {
  if (props.node.assetType === 'repository') return props.workspace.repositories.map(asset => ({ id: asset.id, label: asset.name }))
  if (props.node.assetType === 'member') return props.workspace.members.map(asset => ({ id: asset.id, label: asset.user.name }))
  if (props.node.assetType === 'environment') return props.workspace.environments.map(asset => ({ id: asset.id, label: asset.address }))
  return props.workspace.knowledge.map(asset => ({ id: asset.id, label: asset.title }))
})
</script>

<template>
  <div class="workflow-asset-source">
    <AppFormField field-id="workflow-asset-source" label="资产来源">
      <AppSelect id="workflow-asset-source" :model-value="source" @update:model-value="emit('updateSource', $event as 'input' | 'fixed')">
        <option value="input">输入值（默认）</option>
        <option value="fixed">固定资产</option>
      </AppSelect>
    </AppFormField>
    <p v-if="source === 'input'" class="workflow-operation-help">通过下方参数输入资产 ID，或引用上一份输出（$prev）和根节点输出（$root）。运行时仅允许使用当前项目的资产。</p>
    <AppFormField v-else field-id="workflow-fixed-asset" label="固定资产">
      <AppSelect id="workflow-fixed-asset" :model-value="node.assetId || ''" @update:model-value="emit('updateAssetId', String($event || ''))">
        <option value="">请选择当前项目的资产</option>
        <option v-if="node.assetId && !assets.some(asset => asset.id === node.assetId)" :value="node.assetId" disabled>资产已不存在，请重新选择</option>
        <option v-for="asset in assets" :key="asset.id" :value="asset.id">{{ asset.label }}</option>
      </AppSelect>
      <small v-if="!assets.length">当前项目暂无此类资产，请先登记资产或切换为输入值。</small>
    </AppFormField>
  </div>
</template>

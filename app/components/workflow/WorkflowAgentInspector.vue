<script setup lang="ts">
import type { ProjectWorkspace, WorkflowOperationInputValue, WorkflowOperationNode } from '#shared/types/asdp'
import type { AgentAssetReference } from '#shared/types/agent-executors'
import { agentAssetOptions } from '~/utils/agent-asset-options'

const props = defineProps<{ node: WorkflowOperationNode, workspace: ProjectWorkspace }>()
const emit = defineEmits<{ updateInput: [name: string, value: WorkflowOperationInputValue] }>()
const search = ref('')
const references = computed(() => Array.isArray(props.node.inputs.references) ? props.node.inputs.references as AgentAssetReference[] : [])
const options = computed(() => agentAssetOptions(props.workspace))
const visible = computed(() => options.value.filter(asset => asset.label.toLowerCase().includes(search.value.trim().toLowerCase())))
const selected = (reference: AgentAssetReference) => references.value.some(item => item.assetType === reference.assetType && item.assetId === reference.assetId)
const missing = computed(() => references.value.filter(reference => !options.value.some(option => option.assetType === reference.assetType && option.assetId === reference.assetId)))
const toggle = (reference: AgentAssetReference) => {
  const next = selected(reference) ? references.value.filter(item => item.assetType !== reference.assetType || item.assetId !== reference.assetId)
    : [...references.value, { assetType: reference.assetType, assetId: reference.assetId }]
  if (next.length <= 20) emit('updateInput', 'references', next)
}
</script>

<template>
  <div class="agent-inspector">
    <AppFormField field-id="agent-access" label="文件访问权限" hint="仅作用于引用仓库的工作文件，不包含其他项目、Git 元数据及已知凭据文件。">
      <AppSelect id="agent-access" :model-value="node.inputs.writable === true ? 'write' : 'read'" @update:model-value="emit('updateInput', 'writable', $event === 'write')">
        <option value="read">只读 · 调研与分析</option>
        <option value="write">读写 · 允许修改代码</option>
      </AppSelect>
    </AppFormField>
    <p v-if="node.inputs.writable === true" class="agent-write-warning">成功后将修改应用到引用仓库；检测到并发修改时拒绝覆盖，不自动提交 Git。</p>
    <fieldset class="agent-assets">
      <legend>引用资产 · {{ references.length }}/20</legend>
      <AppInput v-model="search" aria-label="搜索引用资产" placeholder="搜索仓库、知识、环境…" />
      <div class="agent-asset-options">
        <label v-for="asset in visible" :key="asset.assetType + ':' + asset.assetId" class="agent-asset-option">
          <AppCheckbox :model-value="selected(asset)" :disabled="references.length >= 20 && !selected(asset)" @update:model-value="toggle(asset)" />
          <span>{{ asset.label }}</span>
        </label>
        <p v-if="!visible.length" class="workflow-operation-help">没有匹配的项目资产。</p>
      </div>
      <button v-for="asset in missing" :key="asset.assetId" class="agent-missing" type="button" @click="toggle(asset)">移除已失效引用：{{ asset.assetId }}</button>
    </fieldset>
    <AppFormField field-id="agent-prompt" label="自定义提示词" hint="上游结果会自动附加。也可用整个字段 $prev.text 或 $root.xxx 取值，不支持内嵌模板表达式。">
      <AppTextarea id="agent-prompt" :model-value="String(node.inputs.prompt || '')" rows="8" maxlength="32000" required placeholder="描述需要智能体完成的任务、约束和期望输出…" @update:model-value="emit('updateInput', 'prompt', String($event || ''))" />
    </AppFormField>
    <p class="workflow-operation-help">引用内容及上游输出会发送到执行器对应的外部模型。AI 接口引用仅提供名称与平台，不提供 API Key。</p>
    <p class="workflow-operation-help">运行前需配置本机 Docker 执行器镜像和专用凭据，超时上限 10 分钟。最终结果通过 text 字段传给下游。</p>
  </div>
</template>

<style scoped>
.agent-inspector { display: grid; gap: 14px; }
.agent-assets { min-width: 0; margin: 0; padding: 10px; border: 1px solid var(--line); border-radius: 8px; }
.agent-assets legend { padding: 0 4px; font-size: 12px; font-weight: 600; }
.agent-asset-options { display: grid; gap: 9px; max-height: 220px; overflow: auto; padding-top: 12px; }
.agent-asset-option { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; cursor: pointer; }
.agent-asset-option span { min-width: 0; overflow-wrap: anywhere; }
.agent-write-warning, .agent-missing { color: #9a5708; font-size: 12px; line-height: 1.5; }
.agent-write-warning { margin: 0; padding: 10px; background: #fff5df; border-radius: 8px; }
.agent-missing { display: block; margin-top: 8px; border: 0; background: transparent; cursor: pointer; }
</style>

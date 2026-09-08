<script setup lang="ts">
import type { WorkflowAsyncNode } from '#shared/types/asdp'
import { workflowBranchLimit } from '#shared/utils/workflow-nodes'

defineProps<{ node: WorkflowAsyncNode }>()
const emit = defineEmits<{
  updateLabel: [label: string]
  addBranch: []
  renameBranch: [branchId: string, label: string]
  removeBranch: [branchId: string]
}>()
</script>

<template>
  <div class="workflow-async-inspector">
    <AppFormField field-id="workflow-async-label" label="节点名称">
      <AppInput id="workflow-async-label" :model-value="node.label" maxlength="100" @update:model-value="emit('updateLabel', String($event || ''))" />
    </AppFormField>
    <div class="workflow-library-title"><strong>执行子端点</strong><span>{{ node.branches.length }} / {{ workflowBranchLimit }}</span></div>
    <div v-for="(branch, index) in node.branches" :key="branch.id" class="workflow-branch-editor">
      <AppFormField :field-id="'workflow-branch-' + branch.id" :label="'子端点 ' + (index + 1)">
        <AppInput :id="'workflow-branch-' + branch.id" :model-value="branch.label" maxlength="50" @update:model-value="emit('renameBranch', branch.id, String($event || ''))" />
      </AppFormField>
      <AppButton variant="danger-outline" icon="delete" :aria-label="'删除子端点：' + branch.label" :disabled="node.branches.length === 1" @click="emit('removeBranch', branch.id)" />
    </div>
    <AppButton variant="secondary" icon="add" :disabled="node.branches.length >= workflowBranchLimit" @click="emit('addBranch')">添加子端点</AppButton>
    <p class="workflow-operation-help">重命名不改变连线。删除端点只移除该端点的连线，原有子节点仍保留，需要重新连接或手动删除。</p>
    <div class="workflow-output-contract">
      <strong>节点输出类型</strong>
      <span><code>selectedPort: string</code>最终选择的 complete 或 error 出口。</span>
      <span><code>branches: array</code>各执行子端点的结果列表。</span>
    </div>
    <dl class="workflow-async-rules">
      <dt>并发执行</dt><dd>同时启动已连接的子流程，未连接端点不执行；至少连接一个子端点。</dd>
      <dt>完成</dt><dd>全部子流程成功后执行一次。</dd>
      <dt>异常</dt><dd>存在失败时，等待其他子流程结束后执行一次；保留原始失败，运行仍标记为失败。</dd>
    </dl>
  </div>
</template>

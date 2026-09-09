<script setup lang="ts">
import type { WorkflowControlNode } from '#shared/types/asdp'

defineProps<{ node: WorkflowControlNode }>()
const emit = defineEmits<{ updateLabel: [label: string] }>()
</script>

<template>
  <div class="workflow-control-inspector">
    <AppFormField field-id="workflow-control-label" label="节点名称">
      <AppInput id="workflow-control-label" :model-value="node.label" maxlength="100" @update:model-value="emit('updateLabel', String($event || ''))" />
    </AppFormField>
    <div class="workflow-library-title"><strong>逐项执行</strong><span>固定单端点</span></div>
    <p class="workflow-operation-help">无需配置端点数量。连接唯一的子节点后，自动读取上一个节点输出的数组，每个元素执行一次该子流程。</p>
    <p class="workflow-operation-help">子节点的 <code>$prev</code> 是当前数组元素，例如 <code>$prev.id</code> 引用当前资产 ID；<code>$root</code> 仍是根触发器输入。</p>
    <div class="workflow-output-contract">
      <strong>节点输出类型</strong>
      <span><code>selectedPort: string</code>最终选择的 complete 或 error 出口。</span>
      <span><code>branches: array</code>按原数组顺序记录每个元素的 index、input、状态与错误。</span>
    </div>
    <dl class="workflow-control-rules">
      <template v-if="node.kind === 'sync'">
        <dt>顺序执行</dt><dd>按数组索引从小到大执行，等待当前完整子流程结束后再执行下一个元素。</dd>
      </template>
      <template v-else><dt>并发执行</dt><dd>为每个数组元素并发执行同一个子流程，各次输入、输出和状态独立保存。</dd></template>
      <dt>完成</dt><dd>全部元素成功后执行一次。空数组不执行子节点，直接进入完成出口。</dd>
      <dt>异常</dt><dd>{{ node.kind === 'sync' ? '任一元素存在未处理失败时，跳过后续元素并执行一次异常出口。' : '存在未处理失败时，等待其他元素的子流程结束后执行一次异常出口。' }}已配置端点捕获的错误不影响后续元素和完成出口。</dd>
      <dt>输入要求</dt><dd>上一个节点必须直接输出数组，否则不执行子节点，记录 workflow.control-input-not-array 并进入异常出口。</dd>
    </dl>
  </div>
</template>

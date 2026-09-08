<script setup lang="ts">
import type { WorkflowOperationNode } from '#shared/types/asdp'
import { workflowOperationExceptions } from '#shared/utils/workflow-nodes'

const props = defineProps<{ node: WorkflowOperationNode }>()
const emit = defineEmits<{
  addPort: []
  updatePort: [portId: string, code: string]
  removePort: [portId: string]
}>()
const exceptions = computed(() => workflowOperationExceptions(props.node))
const ports = computed(() => props.node.exceptionPorts || [])
const description = (code: string) => exceptions.value.find(exception => exception.code === code)?.description || '错误码已不在操作契约中，请重新选择。'
</script>

<template>
  <section class="workflow-exception-inspector" aria-label="异常端点配置">
    <div class="workflow-library-title"><strong>异常端点</strong><span>{{ ports.length }} / {{ exceptions.length }}</span></div>
    <div v-for="(port, index) in ports" :key="port.id" class="workflow-exception-editor">
      <AppFormField :field-id="'workflow-exception-' + port.id" :label="'异常端点 ' + (index + 1)" :hint="description(port.code)">
        <AppSelect :id="'workflow-exception-' + port.id" :model-value="port.code" @update:model-value="emit('updatePort', port.id, String($event || ''))">
          <option v-for="exception in exceptions" :key="exception.code" :value="exception.code" :disabled="ports.some(other => other.id !== port.id && other.code === exception.code)">
            {{ exception.code }} · {{ exception.description }}
          </option>
        </AppSelect>
      </AppFormField>
      <AppButton variant="danger-outline" icon="delete" :aria-label="'删除异常端点 ' + (index + 1)" @click="emit('removePort', port.id)" />
    </div>
    <AppButton variant="secondary" icon="add" :disabled="ports.length >= exceptions.length" @click="emit('addPort')">添加异常端点</AppButton>
    <p class="workflow-exception-help">添加后，将画板中的红色异常端点连接到处理子节点。按错误码精确匹配，不按错误描述匹配；同一码只能配置一次。</p>
    <p class="workflow-exception-help">成功仅走正常出口；失败仅走匹配且已连接的异常出口。未匹配或未连线时停止当前路径。异常子流程结束后仍保留失败状态，不自动重试。</p>
    <p v-if="ports.length" class="workflow-exception-help">删除端点会移除对应连线，但保留子节点；更换错误码不改变端点 ID 和连线。</p>
  </section>
</template>

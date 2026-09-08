<script setup lang="ts">
import type { WorkflowValueObject } from '#shared/types/asdp'

const props = defineProps<{
  open: boolean
  busy: boolean
  defaultRoot: WorkflowValueObject
  error: string
}>()
const emit = defineEmits<{
  close: []
  run: [root: WorkflowValueObject]
}>()
const rootJson = ref('{}')
const validationError = ref('')

watch(() => props.open, (open) => {
  if (!open) return
  rootJson.value = JSON.stringify(props.defaultRoot, null, 2)
  validationError.value = ''
})

const run = () => {
  try {
    const value = JSON.parse(rootJson.value)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      validationError.value = '根节点输出必须是 JSON 对象。'
      return
    }
    validationError.value = ''
    emit('run', value as WorkflowValueObject)
  } catch {
    validationError.value = '请输入有效的 JSON。'
  }
}
</script>

<template>
  <AppDialog :open="open" :busy="busy" title="运行工作流" overline="ROOT OUTPUT" icon="play" @request-close="emit('close')">
    <p class="dialog-intro">为本次运行设置根触发器输出。节点可通过 <code>$root.xxx</code> 读取，嵌套字段继续使用点号。该数据会写入运行历史，请勿输入 Token、密码或密钥。</p>
    <AppFormField field-id="workflow-root-output" label="根节点输出 · JSON" hint="不需要根数据时保留空对象 {}。数组下标可通过 items.0.id 读取。">
      <AppTextarea id="workflow-root-output" v-model="rootJson" rows="10" spellcheck="false" autofocus />
    </AppFormField>
    <p v-if="validationError || error" class="alert error-state" role="alert">{{ validationError || error }}</p>
    <template #actions>
      <AppButton variant="secondary" :disabled="busy" @click="emit('close')">取消</AppButton>
      <AppButton icon="play" :busy="busy" busy-label="启动中…" @click="run">开始运行</AppButton>
    </template>
  </AppDialog>
</template>

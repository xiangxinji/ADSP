<script setup lang="ts">
import type { LocalWorkspaceSettings } from '#shared/types/asdp'

const { data: settings, status, error, refresh } = await useFetch<LocalWorkspaceSettings>('/api/settings/workspace')
const form = reactive({ path: settings.value?.path || '' })
const saving = ref(false)
const actionError = ref('')
const successMessage = ref('')
const { success } = useAppToast()

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '尚未验证'

const save = async () => {
  saving.value = true
  actionError.value = ''
  successMessage.value = ''
  try {
    const saved = await $fetch<LocalWorkspaceSettings>('/api/settings/workspace', { method: 'PUT', body: form })
    await refresh()
    form.path = saved.path || form.path
    successMessage.value = '本地工作空间已保存，目录可正常读写'
    success(successMessage.value)
  } catch (error: any) {
    actionError.value = error?.data?.statusMessage || error?.message || '操作失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppAsyncState v-if="status === 'pending' || error" :pending="status === 'pending'" :error-message="error?.statusMessage" @retry="refresh" />
  <div v-else class="settings-layout">
    <section>
      <div class="settings-section-heading"><div><p class="overline">LOCAL WORKSPACE</p><h2>本地工作空间</h2><p>仓库检出、任务文件和后续所有业务文件操作都限定在这个目录中。</p></div><span class="connection-state" :class="{ connected: settings?.configured }">{{ settings?.configured ? '已就绪' : '未配置' }}</span></div>
      <form class="panel integration-form" @submit.prevent="save">
        <AppFormField field-id="workspace-path" label="工作空间目录"><AppInput id="workspace-path" v-model="form.path" required autocomplete="off" spellcheck="false" placeholder="例如 C:\ForgePilot\workspaces" /><template #hint>填写运行 ForgePilot 这台电脑上的绝对路径。目录不存在时会自动创建，并检查是否可读写。</template></AppFormField>
        <div v-if="settings?.configured" class="connection-summary workspace-summary"><div><span>当前生效目录</span><strong>{{ settings.path }}</strong></div><div><span>最近更新</span><strong>{{ formatDate(settings.updatedAt) }}</strong></div></div>
        <p v-if="successMessage" class="form-success" role="status">{{ successMessage }}</p>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
        <div class="settings-actions single-action"><AppButton type="submit" icon="save" :busy="saving" busy-label="检查中…">保存并检查目录</AppButton></div>
      </form>
    </section>
    <aside class="panel security-note workspace-note"><div class="security-icon"><AppIcon name="environment" :size="20" /></div><h3>统一目录边界</h3><p>保存后，ForgePilot 会把仓库副本、任务过程文件和生成物统一放在该目录下，避免文件散落到其他位置。</p><ul><li>只能配置绝对路径</li><li>业务路径不能越过此目录</li><li>数据库和加密密钥不随目录迁移</li></ul></aside>
  </div>
</template>

<script setup lang="ts">
import type { ManagedUserAccount } from '#shared/types/asdp'
import UserCreateDialog from '~/components/users/UserCreateDialog.vue'
import UserDirectoryList from '~/components/users/UserDirectoryList.vue'
import UserPasswordDialog from '~/components/users/UserPasswordDialog.vue'

type CreateDialogHandle = { open: () => void }
type PasswordDialogHandle = { open: (user: ManagedUserAccount) => void }

const { data: users, status, error, refresh } = await useFetch<ManagedUserAccount[]>('/api/users')
const createDialog = ref<CreateDialogHandle | null>(null)
const passwordDialog = ref<PasswordDialogHandle | null>(null)
</script>

<template>
  <div class="app-frame">
    <AppHeader badge="Architecture Preview" />
    <main id="main-content" class="page users-page">
      <section class="page-title-row">
        <div><p class="overline">IDENTITY</p><h1>用户管理</h1><p>管理 ForgePilot 平台用户。用户是全局身份，不归属于任何项目。</p></div>
        <AppButton icon="add" @click="createDialog?.open()">新增用户</AppButton>
      </section>
      <AppAsyncState v-if="status === 'pending' || error" :pending="status === 'pending'" :error-message="error?.statusMessage" @retry="refresh" />
      <UserDirectoryList v-else-if="users?.length" :users="users" @password="passwordDialog?.open($event)" />
      <div v-else class="panel empty-state"><strong>还没有用户</strong><span>新增第一位平台用户，建立 ForgePilot 的全局身份目录。</span><AppButton icon="add" @click="createDialog?.open()">新增用户</AppButton></div>
    </main>
    <UserCreateDialog ref="createDialog" @saved="refresh" />
    <UserPasswordDialog ref="passwordDialog" @saved="refresh" />
  </div>
</template>

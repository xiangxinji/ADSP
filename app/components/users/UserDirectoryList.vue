<script setup lang="ts">
import type { ManagedUserAccount, UserRole } from '#shared/types/asdp'

defineProps<{ users: ManagedUserAccount[] }>()
const emit = defineEmits<{ password: [user: ManagedUserAccount] }>()
const roleLabel = (role: UserRole) => ({ administrator: '平台管理员', member: '普通成员' })[role]
const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
</script>

<template>
  <section class="panel user-list" aria-label="用户列表">
    <div class="user-list-heading">
      <div><strong>全部用户</strong><span>共 {{ users.length }} 位</span></div>
      <span>{{ users.filter(user => user.role === 'administrator').length }} 位管理员</span>
    </div>
    <div class="user-table-heading" aria-hidden="true"><span>用户</span><span>平台角色</span><span>密码</span></div>
    <article v-for="user in users" :key="user.id" class="user-row">
      <div class="user-identity">
        <span class="user-avatar">{{ user.name.slice(0, 1).toUpperCase() }}</span>
        <span><strong>{{ user.name }}</strong><small>{{ user.email }}</small><time :datetime="user.createdAt">新增于 {{ formatDate(user.createdAt) }}</time></span>
      </div>
      <span class="user-role" :data-role="user.role">{{ roleLabel(user.role) }}</span>
      <div class="user-password"><span>{{ user.hasPassword ? '已设置' : '未设置' }}</span><AppButton variant="text" @click="emit('password', user)">{{ user.hasPassword ? '重设' : '设置' }}</AppButton></div>
    </article>
  </section>
</template>

<style scoped>
.user-identity time {
  display: block;
  margin-top: 2px;
}

.user-password {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-password > span {
  color: var(--muted);
  font-size: 9px;
}

@media (max-width: 760px) {
  .user-password {
    grid-column: 2;
    justify-content: flex-end;
  }
}
</style>

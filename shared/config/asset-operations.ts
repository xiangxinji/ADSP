import type {
  AssetModuleId,
  AssetOperationConfig,
  AssetOperationDefinition,
  AssetType,
} from '../types/asset-operations'

export const primaryAssetOperationLimit = 2

const repositoryInput = [{
  name: 'repositoryId',
  type: 'string',
  required: true,
  description: '已登记的代码仓库资产 ID。',
}] as const

const repositoryOperationExceptions = [
  { code: 'repository.not-found', description: '仓库资产不存在。' },
  { code: 'repository.operation-in-progress', description: '该仓库已有本地操作正在执行。' },
  { code: 'repository.workspace-not-configured', description: '尚未配置全局本地工作空间。' },
  { code: 'repository.invalid-local-directory', description: '仓库地址无法生成安全的本地目录。' },
  { code: 'repository.git-unavailable', description: 'ForgePilot 运行环境未安装或无法启动 Git。' },
  { code: 'repository.git-command-failed', description: 'Git 命令执行失败，例如远程不可达或权限不足。' },
  { code: 'repository.local-operation-failed', description: '未能归类的本地操作失败。' },
] as const

export const assetOperationConfig = {
  schemaVersion: 3,
  modules: [
    {
      id: 'repositories',
      assetType: 'repository',
      operations: [
        {
          id: 'repository.clone',
          label: '克隆',
          description: '在当前项目的隔离目录中创建仓库工作副本。',
          icon: 'clone',
          placement: 'primary',
          execution: { kind: 'command', command: 'repository.clone' },
          workflow: { enabled: true },
          contract: {
            input: repositoryInput,
            output: [
              { name: 'repositoryId', type: 'string', description: '已克隆的仓库资产 ID。' },
              { name: 'path', type: 'path', description: '创建的本地工作副本路径。' },
            ],
            exceptions: [
              ...repositoryOperationExceptions,
              { code: 'repository.repositories-directory-unavailable', description: '项目 repositories 目录不可用。' },
              { code: 'repository.local-copy-exists', description: '本地工作副本目录已存在，仓库已经克隆。' },
            ],
          },
        },
        {
          id: 'repository.update',
          label: '更新',
          description: '校验远程地址后，以快进方式同步已有工作副本。',
          icon: 'refresh',
          placement: 'primary',
          execution: { kind: 'command', command: 'repository.update' },
          workflow: { enabled: true },
          contract: {
            input: repositoryInput,
            output: [
              { name: 'repositoryId', type: 'string', description: '已更新的仓库资产 ID。' },
              { name: 'path', type: 'path', description: '已同步的本地工作副本路径。' },
            ],
            exceptions: [
              ...repositoryOperationExceptions,
              { code: 'repository.local-copy-missing', description: '本地工作副本目录不存在，请先克隆。' },
              { code: 'repository.remote-mismatch', description: '本地 origin 与仓库资产地址不一致。' },
            ],
          },
        },
        {
          id: 'repository.local-clone-status',
          label: '检查本地克隆',
          description: '确认当前项目中是否已有与仓库资产匹配的本地克隆。',
          icon: 'check',
          placement: 'more',
          execution: { kind: 'command', command: 'repository.local-clone-status' },
          workflow: { enabled: true },
          contract: {
            input: repositoryInput,
            output: [
              { name: 'repositoryId', type: 'string', description: '已检查的仓库资产 ID。' },
              { name: 'cloned', type: 'boolean', description: '本地工作副本是否存在且与仓库资产匹配。' },
              { name: 'path', type: 'path', description: '预期的本地工作副本路径。' },
            ],
            exceptions: repositoryOperationExceptions,
          },
        },
        {
          id: 'repository.create-worktree',
          label: '创建工作树',
          description: '基于指定的现有分支，在项目隔离目录中创建 Git worktree。',
          icon: 'repository',
          placement: 'more',
          execution: { kind: 'command', command: 'repository.create-worktree' },
          workflow: { enabled: true },
          contract: {
            input: [
              ...repositoryInput,
              { name: 'branch', type: 'string', required: true, description: '要检出的现有本地或 origin 分支名称。' },
            ],
            output: [
              { name: 'repositoryId', type: 'string', description: '所属的仓库资产 ID。' },
              { name: 'branch', type: 'string', description: '已检出的分支名称。' },
              { name: 'path', type: 'path', description: '创建的工作树路径。' },
            ],
            exceptions: [
              ...repositoryOperationExceptions,
              { code: 'repository.invalid-worktree-input', description: '请求体不是 JSON 对象。' },
              { code: 'repository.worktree-branch-required', description: '未提供 branch 参数。' },
              { code: 'repository.invalid-worktree-branch', description: 'branch 不是有效的 Git 分支名称。' },
              { code: 'repository.worktree-path-too-long', description: 'branch 生成的工作树目录名称过长。' },
              { code: 'repository.local-copy-missing', description: '本地工作副本目录不存在，请先克隆。' },
              { code: 'repository.remote-mismatch', description: '本地 origin 与仓库资产地址不一致。' },
              { code: 'repository.worktrees-directory-unavailable', description: '项目 worktrees 目录不可用。' },
              { code: 'repository.worktree-exists', description: '目标工作树目录已存在。' },
              { code: 'repository.branch-not-found', description: '指定分支不存在。' },
            ],
          },
        },
        {
          id: 'repository.edit',
          label: '编辑',
          description: '维护仓库地址、托管平台和分支策略。',
          icon: 'edit',
          placement: 'more',
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
        {
          id: 'repository.delete',
          label: '删除',
          description: '移除仓库资产及需求中的关联关系。',
          icon: 'delete',
          placement: 'more',
          danger: true,
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
      ],
    },
    {
      id: 'members',
      assetType: 'member',
      operations: [
        {
          id: 'member.edit',
          label: '编辑角色',
          description: '修改成员在当前项目中的职责。',
          icon: 'edit',
          placement: 'primary',
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
        {
          id: 'member.remove',
          label: '移除',
          description: '移除项目成员及需求中的关联关系。',
          icon: 'delete',
          placement: 'primary',
          danger: true,
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
      ],
    },
    {
      id: 'environments',
      assetType: 'environment',
      operations: [
        {
          id: 'environment.edit',
          label: '编辑',
          description: '维护环境地址、类型、备注和测试账号。',
          icon: 'edit',
          placement: 'primary',
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
        {
          id: 'environment.delete',
          label: '删除',
          description: '移除环境资产及其测试账号。',
          icon: 'delete',
          placement: 'primary',
          danger: true,
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
      ],
    },
    {
      id: 'knowledge',
      assetType: 'knowledge',
      operations: [
        {
          id: 'knowledge.info',
          label: '基本信息',
          description: '查看和修改知识标题。',
          icon: 'settings',
          placement: 'primary',
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
        {
          id: 'knowledge.edit',
          label: '编写正文',
          description: '进入全屏 Markdown 编辑器维护正文。',
          icon: 'edit',
          placement: 'primary',
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
        {
          id: 'knowledge.delete',
          label: '删除',
          description: '删除知识文档，保留其他文档中的原始引用。',
          icon: 'delete',
          placement: 'more',
          danger: true,
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
      ],
    },
  ],
} as const satisfies AssetOperationConfig

export type AssetOperationId = typeof assetOperationConfig.modules[number]['operations'][number]['id']

export const assetOperationModule = (moduleId: AssetModuleId) =>
  assetOperationConfig.modules.find(module => module.id === moduleId)

export const assetOperationsForModule = (moduleId: AssetModuleId): readonly AssetOperationDefinition[] =>
  assetOperationModule(moduleId)?.operations || []

export const findAssetOperation = (assetType: AssetType, operationId: string) =>
  assetOperationConfig.modules
    .find(module => module.assetType === assetType)
    ?.operations.find(operation => operation.id === operationId)

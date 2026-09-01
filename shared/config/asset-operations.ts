import type {
  AssetModuleId,
  AssetOperationConfig,
  AssetOperationDefinition,
  AssetType,
} from '../types/asset-operations'

export const assetOperationConfig = {
  schemaVersion: 1,
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
          execution: { kind: 'command', command: 'repository.clone' },
          workflow: { enabled: true },
        },
        {
          id: 'repository.update',
          label: '更新',
          description: '校验远程地址后，以快进方式同步已有工作副本。',
          icon: 'refresh',
          execution: { kind: 'command', command: 'repository.update' },
          workflow: { enabled: true },
        },
        {
          id: 'repository.edit',
          label: '编辑',
          description: '维护仓库地址、托管平台和分支策略。',
          icon: 'edit',
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
        {
          id: 'repository.delete',
          label: '删除',
          description: '移除仓库资产及需求中的关联关系。',
          icon: 'delete',
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
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
        {
          id: 'member.remove',
          label: '移除',
          description: '移除项目成员及需求中的关联关系。',
          icon: 'delete',
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
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
        {
          id: 'environment.delete',
          label: '删除',
          description: '移除环境资产及其测试账号。',
          icon: 'delete',
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
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
        {
          id: 'knowledge.edit',
          label: '编写正文',
          description: '进入全屏 Markdown 编辑器维护正文。',
          icon: 'edit',
          execution: { kind: 'client' },
          workflow: { enabled: false },
        },
        {
          id: 'knowledge.delete',
          label: '删除',
          description: '删除知识文档，保留其他文档中的原始引用。',
          icon: 'delete',
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

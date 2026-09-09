import type {
  AssetModuleId,
  AssetCommandOperation,
  AssetOperationConfig,
  AssetOperationDefinition,
  AssetOperationField,
  AssetType,
} from '../types/asset-operations'

export const primaryAssetOperationLimit = 2

const assetIdentityFields = [
  { name: 'id', type: 'string', required: true, description: '资产在 ForgePilot 中的稳定 ID。' },
  { name: 'projectId', type: 'string', required: true, description: '所属项目 ID，仅返回当前项目的资产。' },
] as const
const timestampFields = [
  { name: 'createdAt', type: 'string', required: true, description: '创建时间（ISO 8601）。' },
  { name: 'updatedAt', type: 'string', required: true, description: '更新时间（ISO 8601）。' },
] as const
const referenceCountField = { name: 'referenceCount', type: 'number', required: true, description: '关联需求数量。' } as const
const repositoryListFields = [
  ...assetIdentityFields,
  { name: 'name', type: 'string', required: true, description: '仓库名称。' },
  { name: 'note', type: 'string', required: true, description: '仓库备注。' },
  { name: 'provider', type: 'string', required: true, description: '托管平台：gitlab 或 github。' },
  { name: 'branchStrategy', type: 'string', required: true, description: '分支策略：multi-version 或 development-production。' },
  { name: 'externalId', type: 'string', required: true, nullable: true, description: '托管平台的仓库 ID，未登记时为 null。' },
  { name: 'url', type: 'string', required: true, description: '仓库远程地址。' },
  { name: 'localOperation', type: 'object', required: true, nullable: true, description: '最近一次本地操作，无记录时为 null。', fields: [
    { name: 'operationId', type: 'string', required: true, description: '操作契约 ID。' },
    { name: 'status', type: 'string', required: true, description: '操作状态：running、succeeded 或 failed。' },
    { name: 'startedAt', type: 'string', required: true, description: '操作开始时间。' },
    { name: 'finishedAt', type: 'string', required: true, nullable: true, description: '操作结束时间，未结束时为 null。' },
    { name: 'error', type: 'string', required: true, nullable: true, description: '失败说明，无错误时为 null。' },
  ] },
  referenceCountField, ...timestampFields,
] as const satisfies readonly AssetOperationField[]
const memberListFields = [
  ...assetIdentityFields,
  { name: 'userId', type: 'string', required: true, description: '成员关联的全局用户 ID。' },
  { name: 'user', type: 'object', required: true, description: '用户公开资料，不包含登录密码或凭据。', fields: [
    { name: 'id', type: 'string', required: true, description: '全局用户 ID。' },
    { name: 'name', type: 'string', required: true, description: '用户姓名。' },
    { name: 'email', type: 'string', required: true, description: '用户邮箱。' },
    { name: 'role', type: 'string', required: true, description: '全局角色：administrator 或 member。' },
    ...timestampFields,
  ] },
  { name: 'role', type: 'string', required: true, description: '成员在当前项目的职责。' },
  referenceCountField, ...timestampFields,
] as const satisfies readonly AssetOperationField[]
const environmentListFields = [
  ...assetIdentityFields,
  { name: 'address', type: 'string', required: true, description: '环境地址。' },
  { name: 'note', type: 'string', required: true, description: '环境备注。' },
  { name: 'type', type: 'string', required: true, description: '环境类型：development、testing 或 production。' },
  { name: 'accounts', type: 'object[]', required: true, description: '环境中登记的非敏感测试账号数组。', fields: [
    { name: 'account', type: 'string', required: true, description: '测试账号。' },
    { name: 'password', type: 'string', required: true, description: '可选测试密码，未填写时为空字符串；禁止存放生产凭据。' },
  ] },
  ...timestampFields,
] as const satisfies readonly AssetOperationField[]
const knowledgeListFields = [
  ...assetIdentityFields,
  { name: 'title', type: 'string', required: true, description: '知识标题。' },
  { name: 'content', type: 'string', required: true, description: '原始 Markdown 正文。' },
  { name: 'references', type: 'object[]', required: true, description: '正文中解析得到的项目资产引用。', fields: [
    { name: 'assetType', type: 'string', required: true, description: '引用标记中记录的资产类型。' },
    { name: 'targetType', type: 'string', required: true, nullable: true, description: '已识别的目标资产类型，无法识别时为 null。' },
    { name: 'recordId', type: 'string', required: true, description: '被引用的资产 ID。' },
    { name: 'label', type: 'string', required: true, nullable: true, description: '引用显示名称，无法解析时为 null。' },
    { name: 'resolved', type: 'boolean', required: true, description: '是否成功解析为当前项目的资产。' },
  ] },
  ...timestampFields,
] as const satisfies readonly AssetOperationField[]
const projectListExceptions = [
  { code: 'asset.project-not-found', description: '当前项目不存在。' },
  { code: 'asset.operation-not-found', description: '当前资产类型不支持此项目级操作。' },
  { code: 'asset.invalid-input', description: '获取全部资产不接受输入参数或单个资产绑定。' },
  { code: 'asset.list-failed', description: '读取项目资产失败，请检查服务日志。' },
] as const

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
  schemaVersion: 6,
  modules: [
    {
      id: 'repositories',
      assetType: 'repository',
      label: '仓库',
      operations: [
        {
          id: 'repository.list', label: '获取所有仓库', description: '获取当前项目登记的全部仓库，输出 RepositoryAsset[]，无仓库时返回空数组。',
          icon: 'search', placement: 'more', execution: { kind: 'command', command: 'repository.list', scope: 'project' },
          workflow: { enabled: true },
          contract: { input: [], outputType: 'RepositoryAsset[]', output: repositoryListFields, exceptions: projectListExceptions },
        },
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
          id: 'repository.create-branch',
          label: '新建远程分支',
          description: '通过仓库托管平台 API，基于指定原分支创建新的远程分支。',
          icon: 'repository',
          placement: 'more',
          execution: { kind: 'command', command: 'repository.create-branch' },
          workflow: { enabled: true },
          contract: {
            input: [
              ...repositoryInput,
              { name: 'branch', type: 'string', required: true, description: '要创建的新远程分支名称。' },
              { name: 'source', type: 'string', required: true, description: '新分支所基于的原分支名称。' },
            ],
            output: [
              { name: 'repositoryId', type: 'string', description: '所属的仓库资产 ID。' },
              { name: 'branch', type: 'string', description: '已创建的新远程分支名称。' },
              { name: 'source', type: 'string', description: '创建新分支时使用的原分支名称。' },
            ],
            exceptions: [
              { code: 'repository.not-found', description: '仓库资产不存在。' },
              { code: 'repository.invalid-create-branch-input', description: '请求体不是 JSON 对象。' },
              { code: 'repository.branch-required', description: '未提供 branch 参数。' },
              { code: 'repository.source-required', description: '未提供 source 参数。' },
              { code: 'repository.invalid-branch', description: 'branch 不是有效的 Git 分支名称。' },
              { code: 'repository.invalid-source', description: 'source 不是有效的 Git 分支名称。' },
              { code: 'repository.provider-unsupported', description: '仓库托管平台尚不支持通过 API 创建分支。' },
              { code: 'repository.external-id-required', description: '仓库资产没有可用于调用托管平台 API 的外部 ID。' },
              { code: 'repository.gitlab-not-configured', description: '尚未配置全局 GitLab 连接。' },
              { code: 'repository.gitlab-credentials-unavailable', description: '已保存的 GitLab 凭据无法使用。' },
              { code: 'repository.gitlab-unreachable', description: '无法连接 GitLab。' },
              { code: 'repository.gitlab-authentication-failed', description: 'GitLab Access Token 无效或已过期。' },
              { code: 'repository.gitlab-permission-denied', description: 'GitLab Access Token 没有创建分支的权限。' },
              { code: 'repository.remote-repository-not-found', description: 'GitLab 仓库不存在或当前凭据不可见。' },
              { code: 'repository.source-not-found', description: '指定的原分支不存在。' },
              { code: 'repository.branch-already-exists', description: '要创建的远程分支已经存在。' },
              { code: 'repository.gitlab-api-failed', description: 'GitLab API 未能完成分支创建。' },
              { code: 'repository.remote-operation-failed', description: '未能归类的远程仓库操作失败。' },
            ],
          },
        },
        {
          id: 'repository.create-merge-request',
          label: '创建合并请求',
          description: '通过仓库托管平台 API，从源分支向目标分支创建合并请求。',
          icon: 'repository',
          placement: 'more',
          execution: { kind: 'command', command: 'repository.create-merge-request' },
          workflow: { enabled: true },
          contract: {
            input: [
              ...repositoryInput,
              { name: 'source', type: 'string', required: true, description: '包含待合并更改的源分支名称。' },
              { name: 'target', type: 'string', required: true, description: '接收更改的目标分支名称。' },
              { name: 'title', type: 'string', required: true, description: '合并请求标题。' },
            ],
            output: [
              { name: 'repositoryId', type: 'string', description: '所属的仓库资产 ID。' },
              { name: 'mergeRequestId', type: 'string', description: '托管平台返回的合并请求外部 ID。' },
              { name: 'mergeRequestNumber', type: 'string', description: '仓库内可见的合并请求编号。' },
              { name: 'title', type: 'string', description: '已创建的合并请求标题。' },
              { name: 'source', type: 'string', description: '合并请求源分支名称。' },
              { name: 'target', type: 'string', description: '合并请求目标分支名称。' },
              { name: 'webUrl', type: 'string', description: '合并请求 Web 页面地址。' },
            ],
            exceptions: [
              { code: 'repository.not-found', description: '仓库资产不存在。' },
              { code: 'repository.invalid-create-merge-request-input', description: '请求体不是 JSON 对象。' },
              { code: 'repository.source-required', description: '未提供 source 参数。' },
              { code: 'repository.target-required', description: '未提供 target 参数。' },
              { code: 'repository.merge-request-title-required', description: '未提供 title 参数。' },
              { code: 'repository.invalid-source', description: 'source 不是有效的 Git 分支名称。' },
              { code: 'repository.invalid-target', description: 'target 不是有效的 Git 分支名称。' },
              { code: 'repository.invalid-merge-request-title', description: 'title 超出允许长度。' },
              { code: 'repository.merge-request-branches-equal', description: '源分支和目标分支相同。' },
              { code: 'repository.provider-unsupported', description: '仓库托管平台尚不支持通过 API 创建合并请求。' },
              { code: 'repository.external-id-required', description: '仓库资产没有可用于调用托管平台 API 的外部 ID。' },
              { code: 'repository.gitlab-not-configured', description: '尚未配置全局 GitLab 连接。' },
              { code: 'repository.gitlab-credentials-unavailable', description: '已保存的 GitLab 凭据无法使用。' },
              { code: 'repository.gitlab-unreachable', description: '无法连接 GitLab。' },
              { code: 'repository.gitlab-authentication-failed', description: 'GitLab Access Token 无效或已过期。' },
              { code: 'repository.gitlab-permission-denied', description: 'GitLab Access Token 没有创建合并请求的权限。' },
              { code: 'repository.remote-repository-not-found', description: 'GitLab 仓库不存在或当前凭据不可见。' },
              { code: 'repository.source-not-found', description: '指定的源分支不存在。' },
              { code: 'repository.target-not-found', description: '指定的目标分支不存在。' },
              { code: 'repository.merge-request-already-exists', description: '相同源分支与目标分支的打开合并请求已经存在。' },
              { code: 'repository.merge-request-no-changes', description: '源分支没有可合并到目标分支的更改。' },
              { code: 'repository.merge-request-rejected', description: '托管平台拒绝创建合并请求。' },
              { code: 'repository.gitlab-api-failed', description: 'GitLab API 未能完成合并请求创建。' },
              { code: 'repository.remote-operation-failed', description: '未能归类的远程仓库操作失败。' },
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
      label: '成员',
      operations: [
        {
          id: 'member.list', label: '获取所有成员', description: '获取当前项目的全部成员，输出 ProjectMember[]，无成员时返回空数组。',
          icon: 'search', placement: 'more', execution: { kind: 'command', command: 'member.list', scope: 'project' },
          workflow: { enabled: true },
          contract: { input: [], outputType: 'ProjectMember[]', output: memberListFields, exceptions: projectListExceptions },
        },
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
      label: '环境',
      operations: [
        {
          id: 'environment.list', label: '获取所有环境', description: '获取当前项目登记的全部环境，输出 EnvironmentAsset[]，无环境时返回空数组。',
          icon: 'search', placement: 'more', execution: { kind: 'command', command: 'environment.list', scope: 'project' },
          workflow: { enabled: true },
          contract: { input: [], outputType: 'EnvironmentAsset[]', output: environmentListFields, exceptions: projectListExceptions },
        },
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
      label: '知识',
      operations: [
        {
          id: 'knowledge.list', label: '获取所有知识', description: '获取当前项目的全部知识正文与引用，输出 KnowledgeAsset[]，无知识时返回空数组。',
          icon: 'search', placement: 'more', execution: { kind: 'command', command: 'knowledge.list', scope: 'project' },
          workflow: { enabled: true },
          contract: { input: [], outputType: 'KnowledgeAsset[]', output: knowledgeListFields, exceptions: projectListExceptions },
        },
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

export const isProjectAssetOperation = (operation?: AssetOperationDefinition): operation is AssetCommandOperation & { execution: { scope: 'project' } } =>
  operation?.execution.kind === 'command' && operation.execution.scope === 'project'

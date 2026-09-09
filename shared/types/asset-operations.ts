export const assetModuleIds = ['repositories', 'members', 'environments', 'knowledge'] as const
export const assetTypes = ['repository', 'member', 'environment', 'knowledge'] as const

export type AssetModuleId = typeof assetModuleIds[number]
export type AssetType = typeof assetTypes[number]

export type AssetOperationIcon =
  | 'clone'
  | 'delete'
  | 'edit'
  | 'refresh'
  | 'settings'
  | 'search'

export type AssetOperationPlacement = 'primary' | 'more'
export type AssetOperationValueType = 'string' | 'boolean' | 'path' | 'number' | 'object' | 'object[]'
export type AssetOperationArrayType = 'RepositoryAsset[]' | 'ProjectMember[]' | 'EnvironmentAsset[]' | 'KnowledgeAsset[]'

export type AssetOperationField = {
  name: string
  type: AssetOperationValueType
  description: string
  required?: boolean
  nullable?: boolean
  fields?: readonly AssetOperationField[]
}

export type AssetOperationException = {
  code: string
  description: string
}

export type AssetOperationContract = {
  input: readonly AssetOperationField[]
  output: readonly AssetOperationField[]
  outputType?: AssetOperationArrayType
  exceptions: readonly AssetOperationException[]
}

export type AssetOperationBase = {
  id: string
  label: string
  description: string
  icon: AssetOperationIcon
  placement: AssetOperationPlacement
  danger?: boolean
}

export type AssetCommandOperation = AssetOperationBase & {
  execution: {
    kind: 'command'
    command: string
    scope?: 'asset' | 'project'
  }
  workflow: {
    enabled: true
  }
  contract: AssetOperationContract
}

export type AssetClientOperation = AssetOperationBase & {
  execution: {
    kind: 'client'
  }
  workflow: {
    enabled: false
  }
}

export type AssetOperationDefinition = AssetCommandOperation | AssetClientOperation

export type AssetOperationModule = {
  id: AssetModuleId
  assetType: AssetType
  label: string
  operations: readonly AssetOperationDefinition[]
}

export type AssetOperationConfig = {
  schemaVersion: 6
  modules: readonly AssetOperationModule[]
}

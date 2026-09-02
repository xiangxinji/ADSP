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

export type AssetOperationPlacement = 'primary' | 'more'

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
  }
  workflow: {
    enabled: true
  }
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
  operations: readonly AssetOperationDefinition[]
}

export type AssetOperationConfig = {
  schemaVersion: 2
  modules: readonly AssetOperationModule[]
}

export const requirementPriorities = ['low', 'medium', 'high', 'urgent'] as const
export const repositoryProviders = ['gitlab', 'github'] as const
export const repositoryBranchStrategies = ['multi-version', 'development-production'] as const
export const environmentTypes = ['development', 'testing', 'production'] as const
export const knowledgeReferenceTypes = ['repository', 'member', 'environment', 'knowledge'] as const
export const userRoles = ['administrator', 'member'] as const

export type RequirementPriority = typeof requirementPriorities[number]
export type RepositoryProvider = typeof repositoryProviders[number]
export type RepositoryBranchStrategy = typeof repositoryBranchStrategies[number]
export type EnvironmentType = typeof environmentTypes[number]
export type KnowledgeReferenceType = typeof knowledgeReferenceTypes[number]
export type UserRole = typeof userRoles[number]

export type UserAccount = {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
  updatedAt: string
}

export type Project = {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export type ProjectSummary = Project & {
  requirementCount: number
  repositoryCount: number
  memberCount: number
  environmentCount: number
  knowledgeCount: number
}

export type RepositoryAsset = {
  id: string
  projectId: string
  provider: RepositoryProvider
  branchStrategy: RepositoryBranchStrategy
  externalId: string | null
  name: string
  note: string
  url: string
  referenceCount: number
  createdAt: string
  updatedAt: string
}

export type EnvironmentAccount = {
  account: string
  password: string
}

export type EnvironmentAsset = {
  id: string
  projectId: string
  address: string
  note: string
  type: EnvironmentType
  accounts: EnvironmentAccount[]
  createdAt: string
  updatedAt: string
}

export type KnowledgeReference = {
  assetType: string
  targetType: KnowledgeReferenceType | null
  recordId: string
  label: string | null
  resolved: boolean
}

export type KnowledgeAsset = {
  id: string
  projectId: string
  title: string
  content: string
  references: KnowledgeReference[]
  createdAt: string
  updatedAt: string
}

export type GitLabIdentity = {
  id: number
  name: string
  username: string
}

export type GitLabSettings = {
  baseUrl: string
  configured: boolean
  tokenHint: string
  connectedUser: GitLabIdentity | null
  verifiedAt: string | null
  updatedAt: string | null
}

export type LocalWorkspaceSettings = {
  path: string | null
  configured: boolean
  updatedAt: string | null
}

export type GitLabRepository = {
  id: number
  name: string
  nameWithNamespace: string
  webUrl: string
  httpUrlToRepo: string
  defaultBranch: string
  visibility: string
  archived: boolean
}

export type GitLabRepositoryPage = {
  items: GitLabRepository[]
  page: number
  perPage: number
  total: number | null
  nextPage: number | null
}

export type ProjectMember = {
  id: string
  projectId: string
  userId: string
  user: UserAccount
  role: string
  referenceCount: number
  createdAt: string
  updatedAt: string
}

export type RequirementStatus = {
  id: string
  projectId: string
  key: string
  name: string
  color: string
  sortOrder: number
  isInitial: boolean
  isTerminal: boolean
  requirementCount: number
  createdAt: string
  updatedAt: string
}

export type RequirementVersion = {
  id: string
  projectId: string
  major: number
  name: string
  isLatest: boolean
  requirementCount: number
  createdAt: string
  updatedAt: string
}

export type Requirement = {
  id: string
  projectId: string
  title: string
  description: string
  acceptanceCriteria: string
  statusId: string
  status: RequirementStatus
  priority: RequirementPriority
  versionIds: string[]
  repositoryIds: string[]
  memberIds: string[]
  versions: RequirementVersion[]
  repositories: RepositoryAsset[]
  members: ProjectMember[]
  createdAt: string
  updatedAt: string
}

export type ProjectWorkspace = {
  project: Project
  requirements: Requirement[]
  requirementStatuses: RequirementStatus[]
  requirementVersions: RequirementVersion[]
  repositories: RepositoryAsset[]
  members: ProjectMember[]
  environments: EnvironmentAsset[]
  knowledge: KnowledgeAsset[]
}

export type CreateProjectInput = Pick<Project, 'name' | 'description'>
export type UpdateProjectInput = Partial<CreateProjectInput>
export type CreateUserInput = Pick<UserAccount, 'name' | 'email' | 'role'>
export type CreateRepositoryInput = Pick<RepositoryAsset, 'provider' | 'name' | 'url'> & {
  branchStrategy?: RepositoryBranchStrategy
  externalId?: string | null
  note?: string
}
export type UpdateRepositoryInput = Partial<CreateRepositoryInput>
export type CreateEnvironmentInput = Pick<EnvironmentAsset, 'address' | 'type' | 'accounts'> & {
  note?: string
}
export type UpdateEnvironmentInput = Partial<CreateEnvironmentInput>
export type CreateKnowledgeInput = Pick<KnowledgeAsset, 'title' | 'content'>
export type UpdateKnowledgeInput = Partial<CreateKnowledgeInput>
export type CreateProjectMemberInput = Pick<ProjectMember, 'userId' | 'role'>
export type UpdateProjectMemberInput = Pick<ProjectMember, 'role'>
export type CreateRequirementStatusInput = Pick<RequirementStatus, 'key' | 'name' | 'color' | 'sortOrder' | 'isInitial' | 'isTerminal'>
export type UpdateRequirementStatusInput = Partial<CreateRequirementStatusInput>
export type CreateRequirementVersionInput = Pick<RequirementVersion, 'major'>
export type UpdateRequirementVersionInput = Partial<CreateRequirementVersionInput>
export type CreateRequirementInput = Pick<Requirement, 'title' | 'description' | 'acceptanceCriteria' | 'priority' | 'versionIds' | 'repositoryIds' | 'memberIds'> & {
  statusId?: string
}
export type UpdateRequirementInput = Partial<CreateRequirementInput>

export const requirementPriorities = ['low', 'medium', 'high', 'urgent'] as const
export const repositoryProviders = ['gitlab', 'github'] as const
export const userRoles = ['administrator', 'member'] as const

export type RequirementPriority = typeof requirementPriorities[number]
export type RepositoryProvider = typeof repositoryProviders[number]
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
  personCount: number
}

export type RepositoryAsset = {
  id: string
  projectId: string
  provider: RepositoryProvider
  externalId: string | null
  name: string
  url: string
  defaultBranch: string
  referenceCount: number
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

export type PersonAsset = {
  id: string
  projectId: string
  name: string
  email: string
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

export type Requirement = {
  id: string
  projectId: string
  title: string
  description: string
  acceptanceCriteria: string
  statusId: string
  status: RequirementStatus
  priority: RequirementPriority
  repositoryIds: string[]
  personIds: string[]
  repositories: RepositoryAsset[]
  people: PersonAsset[]
  createdAt: string
  updatedAt: string
}

export type ProjectWorkspace = {
  project: Project
  requirements: Requirement[]
  requirementStatuses: RequirementStatus[]
  repositories: RepositoryAsset[]
  people: PersonAsset[]
}

export type CreateProjectInput = Pick<Project, 'name' | 'description'>
export type UpdateProjectInput = Partial<CreateProjectInput>
export type CreateUserInput = Pick<UserAccount, 'name' | 'email' | 'role'>
export type CreateRepositoryInput = Pick<RepositoryAsset, 'provider' | 'name' | 'url' | 'defaultBranch'> & {
  externalId?: string | null
}
export type UpdateRepositoryInput = Partial<CreateRepositoryInput>
export type CreatePersonInput = Pick<PersonAsset, 'name' | 'email' | 'role'>
export type UpdatePersonInput = Partial<CreatePersonInput>
export type CreateRequirementStatusInput = Pick<RequirementStatus, 'key' | 'name' | 'color' | 'sortOrder' | 'isInitial' | 'isTerminal'>
export type UpdateRequirementStatusInput = Partial<CreateRequirementStatusInput>
export type CreateRequirementInput = Pick<Requirement, 'title' | 'description' | 'acceptanceCriteria' | 'priority' | 'repositoryIds' | 'personIds'> & {
  statusId?: string
}
export type UpdateRequirementInput = Partial<CreateRequirementInput>

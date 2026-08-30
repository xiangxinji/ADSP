import type { ProjectWorkspace } from '../../shared/types/asdp'
import { listMembersForProject } from './project-members'
import { getProject } from './projects'
import { listProjectRepositories } from './repository-assets'
import { listRequirementStatusesForProject } from './requirement-statuses'
import { listRequirementsForProject } from './requirements'

export const getProjectWorkspace = (projectId: string): ProjectWorkspace => ({
  project: getProject(projectId),
  requirements: listRequirementsForProject(projectId),
  requirementStatuses: listRequirementStatusesForProject(projectId),
  repositories: listProjectRepositories(projectId),
  members: listMembersForProject(projectId),
})

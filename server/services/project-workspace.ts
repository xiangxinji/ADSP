import type { ProjectWorkspace } from '../../shared/types/asdp'
import { listProjectEnvironments } from './environment-assets'
import { listMembersForProject } from './project-members'
import { listProjectKnowledge } from './knowledge-assets'
import { getProject } from './projects'
import { listProjectRepositories } from './repository-assets'
import { listRequirementStatusesForProject } from './requirement-statuses'
import { listRequirementVersionsForProject } from './requirement-versions'
import { listRequirementsForProject } from './requirements'

export const getProjectWorkspace = (projectId: string): ProjectWorkspace => ({
  project: getProject(projectId),
  requirements: listRequirementsForProject(projectId),
  requirementStatuses: listRequirementStatusesForProject(projectId),
  requirementVersions: listRequirementVersionsForProject(projectId),
  repositories: listProjectRepositories(projectId),
  members: listMembersForProject(projectId),
  environments: listProjectEnvironments(projectId),
  knowledge: listProjectKnowledge(projectId),
})

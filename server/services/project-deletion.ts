import { runInTransaction } from '../repositories/unit-of-work'
import { deleteProjectAiInterfaces } from './ai-interface-assets'
import { deleteProject } from './projects'
import { deleteProjectWorkflows } from './workflow-definitions'

export const deleteProjectWorkspace = (projectId: string) => runInTransaction(() => {
  deleteProjectWorkflows(projectId)
  deleteProjectAiInterfaces(projectId)
  deleteProject(projectId)
})

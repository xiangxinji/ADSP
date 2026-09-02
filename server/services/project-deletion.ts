import { runInTransaction } from '../repositories/unit-of-work'
import { deleteProject } from './projects'
import { deleteProjectWorkflows } from './workflow-definitions'

export const deleteProjectWorkspace = (projectId: string) => runInTransaction(() => {
  deleteProjectWorkflows(projectId)
  deleteProject(projectId)
})

import type { CreateProjectInput } from '../../../shared/types/asdp'
import { createProject } from '../../services/projects'
import { projectPayload } from '../../validation/projects'

export default defineEventHandler(async (event) => {
  const project = createProject(projectPayload(await readBody(event)) as CreateProjectInput)
  setResponseStatus(event, 201)
  return project
})

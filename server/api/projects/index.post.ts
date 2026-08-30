import type { CreateProjectInput } from '../../../shared/types/asdp'
import { createProject } from '../../utils/asdp-store'
import { projectPayload } from '../../utils/payloads'

export default defineEventHandler(async (event) => {
  const project = createProject(projectPayload(await readBody(event)) as CreateProjectInput)
  setResponseStatus(event, 201)
  return project
})

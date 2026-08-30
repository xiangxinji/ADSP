import type { UpdateProjectInput } from '../../../shared/types/asdp'
import { updateProject } from '../../services/projects'
import { routeParameter } from '../../utils/http-input'
import { projectPayload } from '../../validation/projects'

export default defineEventHandler(async (event) => updateProject(
  routeParameter(event),
  projectPayload(await readBody(event), true) as UpdateProjectInput,
))

import type { UpdateKnowledgeInput } from '../../../shared/types/asdp'
import { updateKnowledge } from '../../services/knowledge-assets'
import { routeParameter } from '../../utils/http-input'
import { knowledgePayload } from '../../validation/knowledge-assets'

export default defineEventHandler(async event => updateKnowledge(
  routeParameter(event),
  knowledgePayload(await readBody(event), true) as UpdateKnowledgeInput,
))

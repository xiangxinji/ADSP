import type { CreateKnowledgeInput } from '../../../../../shared/types/asdp'
import { createKnowledge } from '../../../../services/knowledge-assets'
import { routeParameter } from '../../../../utils/http-input'
import { knowledgePayload } from '../../../../validation/knowledge-assets'

export default defineEventHandler(async (event) => {
  const knowledge = createKnowledge(
    routeParameter(event),
    knowledgePayload(await readBody(event)) as CreateKnowledgeInput,
  )
  setResponseStatus(event, 201)
  return knowledge
})

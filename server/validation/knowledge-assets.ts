import type { CreateKnowledgeInput, UpdateKnowledgeInput } from '../../shared/types/asdp'
import { bodyObject, requiredText } from '../utils/http-input'

const markdownContent = (value: unknown) => {
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'content must be a string' })
  }
  return value
}

export const knowledgePayload = (
  value: unknown,
  partial = false,
): CreateKnowledgeInput | UpdateKnowledgeInput => {
  const body = bodyObject(value)
  return {
    title: partial && body.title === undefined ? undefined : requiredText(body.title, 'title'),
    content: partial && body.content === undefined ? undefined : markdownContent(body.content),
  }
}

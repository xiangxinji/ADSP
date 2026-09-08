import { createError } from 'h3'
import { bodyObject } from '../utils/http-input'

export const workflowRunPayload = (value: unknown) => {
  if (value === undefined || value === null || value === '') return
  if (Object.keys(bodyObject(value)).length) {
    throw createError({ statusCode: 400, statusMessage: '运行只接受已保存的工作流，不支持覆盖节点或项目' })
  }
}

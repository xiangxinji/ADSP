import type { CreateRequirementInput, UpdateRequirementInput } from '../../shared/types/asdp'
import { requirementPriorities } from '../../shared/types/asdp'
import {
  bodyObject,
  enumValue,
  optionalStringArray,
  optionalText,
  requiredText,
} from '../utils/http-input'

export const requirementPayload = (
  value: unknown,
  partial = false,
): CreateRequirementInput | UpdateRequirementInput => {
  const body = bodyObject(value)
  return {
    title: partial && body.title === undefined ? undefined : requiredText(body.title, 'title'),
    description: partial && body.description === undefined ? undefined : optionalText(body.description),
    acceptanceCriteria: partial && body.acceptanceCriteria === undefined
      ? undefined
      : optionalText(body.acceptanceCriteria),
    statusId: body.statusId === undefined ? undefined : requiredText(body.statusId, 'statusId'),
    priority: partial && body.priority === undefined
      ? undefined
      : enumValue(body.priority, requirementPriorities, 'medium'),
    repositoryIds: partial && body.repositoryIds === undefined
      ? undefined
      : optionalStringArray(body.repositoryIds),
    memberIds: partial && body.memberIds === undefined ? undefined : optionalStringArray(body.memberIds),
  }
}

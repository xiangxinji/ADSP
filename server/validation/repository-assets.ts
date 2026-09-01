import type { CreateRepositoryInput, UpdateRepositoryInput } from '../../shared/types/asdp'
import { repositoryBranchStrategies, repositoryProviders } from '../../shared/types/asdp'
import { bodyObject, enumValue, optionalText, requiredText } from '../utils/http-input'

export const repositoryPayload = (
  value: unknown,
  partial = false,
): CreateRepositoryInput | UpdateRepositoryInput => {
  const body = bodyObject(value)
  return {
    provider: partial && body.provider === undefined
      ? undefined
      : enumValue(body.provider, repositoryProviders, 'gitlab'),
    branchStrategy: partial && body.branchStrategy === undefined
      ? undefined
      : enumValue(body.branchStrategy, repositoryBranchStrategies, 'multi-version'),
    externalId: partial && body.externalId === undefined
      ? undefined
      : body.externalId === null
        ? null
        : optionalText(body.externalId) || null,
    name: partial && body.name === undefined ? undefined : requiredText(body.name, 'name'),
    note: partial && body.note === undefined ? undefined : optionalText(body.note),
    url: partial && body.url === undefined ? undefined : requiredText(body.url, 'url'),
  }
}

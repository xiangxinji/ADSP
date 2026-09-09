import type { AssetOperationContract, AssetOperationField } from '../types/asset-operations'

export const assetOperationOutputType = (contract: AssetOperationContract) => contract.outputType || 'object'

export const assetOperationOutputFields = (contract: AssetOperationContract): AssetOperationField[] => {
  const flatten = (fields: readonly AssetOperationField[], prefix: string): AssetOperationField[] => fields.flatMap(field => {
    const name = prefix + field.name
    if (field.fields) return flatten(field.fields, name + (field.type === 'object[]' ? '.0.' : '.'))
    return [{ ...field, name }]
  })
  return flatten(contract.output, contract.outputType ? '0.' : '')
}

import type { AiInterfaceAsset } from '../../shared/types/ai-interfaces'

export type AiInterfaceRecord = Omit<AiInterfaceAsset, 'hasApiKey'> & {
  encryptedApiKey: string
}

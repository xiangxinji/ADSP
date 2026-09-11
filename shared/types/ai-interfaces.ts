export type AiInterfaceAsset = {
  id: string
  projectId: string
  provider: string
  name: string
  hasApiKey: boolean
  createdAt: string
  updatedAt: string
}

export type CreateAiInterfaceInput = Pick<AiInterfaceAsset, 'provider' | 'name'> & {
  apiKey: string
}

export type UpdateAiInterfaceInput = Partial<CreateAiInterfaceInput>

export type AgentRepository = { assetId: string, name: string, path: string }
export type AgentRunnerRequest = {
  directory: string
  prompt: string
  writable: boolean
  executor: 'codex' | 'claude-code'
}

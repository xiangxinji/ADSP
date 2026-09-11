import { randomUUID } from 'node:crypto'
import { chmod, copyFile, mkdir, rm, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { AgentRepository } from '../domain/agent-executors'
import { createAssetOperationError } from '../utils/asset-operation-error'
import { agentProjectPath, createAgentDirectory, inspectAgentFiles, type AgentFile } from '../utils/agent-workspace'
import { resolveProjectWorkspacePath } from '../utils/workspace-path'
import { requireLocalWorkspaceRoot } from './local-workspace-settings'

type Snapshot = { source: string, directory: string, baseline: Map<string, AgentFile> }
const applyingProjects = new Set<string>()

export const createAgentWorkspace = async (projectId: string, repositories: AgentRepository[]) => {
  const root = requireLocalWorkspaceRoot()
  const directory = resolveProjectWorkspacePath(root, projectId, 'agent-runs', randomUUID())
  const snapshots: Snapshot[] = []
  const dispose = async () => {
    await agentProjectPath(root, projectId, directory)
    await rm(directory, { recursive: true, force: true })
  }
  try {
    await createAgentDirectory(root, projectId, directory)
    await chmod(directory, 0o777)
    for (const repository of repositories) {
      const source = await agentProjectPath(root, projectId, repository.path)
      if (snapshots.some(snapshot => snapshot.source === source)) throw new Error('Duplicate repository working directory')
      const baseline = await inspectAgentFiles(root, projectId, source)
      const snapshot = resolveProjectWorkspacePath(root, projectId, directory, 'repositories', repository.assetId)
      await createAgentDirectory(root, projectId, snapshot)
      await chmod(dirname(snapshot), 0o777)
      await chmod(snapshot, 0o777)
      for (const [name] of baseline) {
        const from = await agentProjectPath(root, projectId, resolveProjectWorkspacePath(root, projectId, source, name))
        const to = resolveProjectWorkspacePath(root, projectId, snapshot, name)
        await mkdir(dirname(to), { recursive: true, mode: 0o777 })
        let parent = dirname(to)
        while (parent !== snapshot) {
          await chmod(parent, 0o777)
          parent = dirname(parent)
        }
        await copyFile(from, to)
        await chmod(to, 0o666)
      }
      const copied = await inspectAgentFiles(root, projectId, snapshot)
      if ([...baseline].some(([name, file]) => copied.get(name)?.hash !== file.hash)) throw new Error('Repository changed during snapshot')
      snapshots.push({ source, directory: snapshot, baseline })
    }
  } catch (error) {
    await dispose()
    throw createAssetOperationError(409, 'agent.workspace-unavailable', '无法创建安全代码快照：请检查路径、符号链接、文件权限和仓库大小（最多 10000 文件 / 64 MiB）。', error)
  }

  const apply = async () => {
    if (applyingProjects.has(projectId)) throw createAssetOperationError(409, 'agent.workspace-conflict', '当前项目正在应用其他智能体的修改，请重试。')
    applyingProjects.add(projectId)
    try {
      const changes: { source: string, target: string, mode: number, remove: boolean }[] = []
      for (const snapshot of snapshots) {
        const current = await inspectAgentFiles(root, projectId, snapshot.source)
        const result = await inspectAgentFiles(root, projectId, snapshot.directory)
        for (const name of new Set([...snapshot.baseline.keys(), ...result.keys()])) {
          const before = snapshot.baseline.get(name)
          const after = result.get(name)
          if (before?.hash === after?.hash) continue
          if (before?.hash !== current.get(name)?.hash) {
            throw createAssetOperationError(409, 'agent.workspace-conflict', '仓库文件在执行期间已被修改，智能体结果未覆盖这些文件。')
          }
          changes.push({
            source: await agentProjectPath(root, projectId, resolveProjectWorkspacePath(root, projectId, snapshot.directory, name)),
            target: await agentProjectPath(root, projectId, resolveProjectWorkspacePath(root, projectId, snapshot.source, name)),
            mode: before?.mode ?? 0o644, remove: !after,
          })
        }
      }
      for (const change of changes) {
        await agentProjectPath(root, projectId, change.target)
        if (change.remove) await unlink(change.target)
        else {
          await createAgentDirectory(root, projectId, dirname(change.target))
          await copyFile(change.source, change.target)
          await chmod(change.target, change.mode)
        }
      }
    } finally {
      applyingProjects.delete(projectId)
    }
  }
  return { directory, apply, dispose }
}

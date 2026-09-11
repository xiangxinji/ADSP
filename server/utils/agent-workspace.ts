import { createHash } from 'node:crypto'
import { lstat, mkdir, readdir, readFile, realpath } from 'node:fs/promises'
import { relative, sep } from 'node:path'
import { resolveProjectWorkspacePath, resolveWithinWorkspace } from './workspace-path'

export const agentExcludedPath = (path: string) => path.split(/[\\/]/).some(part =>
  ['.git', '.codex', '.claude', '.data', '.nuxt', '.output', 'node_modules', '.ssh', '.aws', '.azure', '.config'].includes(part.toLowerCase())
  || /^\.env(?:\.|$)/i.test(part) || /\.(?:pem|key|p12|pfx)$/i.test(part)
  || /^(?:\.npmrc|\.netrc|credentials(?:\.json)?|auth\.json|\.mcp\.json)$/i.test(part))

export const agentProjectPath = async (root: string, projectId: string, path?: string) => {
  const projectRoot = resolveProjectWorkspacePath(root, projectId)
  const target = resolveProjectWorkspacePath(root, projectId, ...(path ? [path] : []))
  const canonicalRoot = await realpath(root)
  let current = canonicalRoot
  for (const part of relative(root, target).split(sep).filter(Boolean)) {
    current = resolveWithinWorkspace(current, part)
    try {
      const info = await lstat(current)
      if (info.isSymbolicLink()) throw new Error('Symbolic links are not allowed')
      resolveWithinWorkspace(canonicalRoot, await realpath(current))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  resolveWithinWorkspace(projectRoot, target)
  return target
}

export const createAgentDirectory = async (root: string, projectId: string, path: string) => {
  const target = await agentProjectPath(root, projectId, path)
  await mkdir(target, { recursive: true, mode: 0o700 })
  return agentProjectPath(root, projectId, target)
}

export type AgentFile = { hash: string, mode: number }
export const inspectAgentFiles = async (root: string, projectId: string, directory: string) => {
  const files = new Map<string, AgentFile>()
  let bytes = 0
  const visit = async (path: string) => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const target = resolveProjectWorkspacePath(root, projectId, path, entry.name)
      const name = relative(directory, target).split(sep).join('/')
      if (agentExcludedPath(name)) continue
      if (entry.isSymbolicLink()) throw new Error('Repository contains symbolic links')
      if (entry.isDirectory()) await visit(target)
      else if (entry.isFile()) {
        const info = await lstat(target)
        if (info.isSymbolicLink() || info.nlink > 1) throw new Error('Linked files are not allowed')
        bytes += info.size
        if (bytes > 64 * 1024 * 1024 || files.size >= 10_000) throw new Error('Repository exceeds agent snapshot limits')
        const content = await readFile(target)
        files.set(name, { hash: createHash('sha256').update(content).digest('hex'), mode: info.mode & 0o777 })
      } else throw new Error('Special files are not allowed')
    }
  }
  await visit(await agentProjectPath(root, projectId, directory))
  return files
}

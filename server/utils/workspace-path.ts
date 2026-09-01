import { isAbsolute, parse, relative, resolve, sep } from 'node:path'

export class InvalidWorkspacePathError extends Error {}

const isContainedPath = (root: string, target: string) => {
  const relativePath = relative(root, target)
  return relativePath === ''
    || (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
}

export const normalizeWorkspaceRoot = (path: string) => {
  if (!isAbsolute(path)) {
    throw new InvalidWorkspacePathError('工作空间必须使用绝对路径')
  }
  const normalizedPath = resolve(path)
  if (normalizedPath === parse(normalizedPath).root) {
    throw new InvalidWorkspacePathError('不能把整个磁盘或文件系统根目录设为工作空间')
  }
  return normalizedPath
}

export const resolveWithinWorkspace = (root: string, ...segments: string[]) => {
  const normalizedRoot = normalizeWorkspaceRoot(root)
  const target = resolve(normalizedRoot, ...segments)
  if (!isContainedPath(normalizedRoot, target)) {
    throw new InvalidWorkspacePathError('文件路径不能超出已配置的本地工作空间')
  }
  return target
}

export const resolveProjectWorkspacePath = (
  workspaceRoot: string,
  projectId: string,
  ...segments: string[]
) => {
  if (!projectId
    || projectId === '.'
    || projectId === '..'
    || projectId.includes('/')
    || projectId.includes('\\')
    || isAbsolute(projectId)) {
    throw new InvalidWorkspacePathError('项目 ID 不能包含路径分隔符或目录跳转')
  }

  const projectsRoot = resolveWithinWorkspace(workspaceRoot, 'projects')
  const projectRoot = resolveWithinWorkspace(projectsRoot, projectId)
  try {
    return resolveWithinWorkspace(projectRoot, ...segments)
  } catch (error) {
    if (error instanceof InvalidWorkspacePathError) {
      throw new InvalidWorkspacePathError('文件路径不能超出对应的项目工作目录')
    }
    throw error
  }
}

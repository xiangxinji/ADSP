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

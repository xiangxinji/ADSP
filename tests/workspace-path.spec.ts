import { dirname, join, parse } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  InvalidWorkspacePathError,
  normalizeWorkspaceRoot,
  resolveProjectWorkspacePath,
  resolveWithinWorkspace,
} from '../server/utils/workspace-path'

describe('workspace path boundary', () => {
  const root = join(process.cwd(), '.data', 'workspaces')

  test('normalizes an absolute workspace root and resolves descendants', () => {
    const normalizedRoot = normalizeWorkspaceRoot(root)
    expect(resolveWithinWorkspace(root, 'project-a', 'repository')).toBe(
      join(normalizedRoot, 'project-a', 'repository'),
    )
    expect(resolveWithinWorkspace(root, '..notes')).toBe(join(normalizedRoot, '..notes'))
  })

  test('rejects relative roots and filesystem roots', () => {
    expect(() => normalizeWorkspaceRoot('workspaces')).toThrow(InvalidWorkspacePathError)
    expect(() => normalizeWorkspaceRoot(parse(root).root)).toThrow(InvalidWorkspacePathError)
  })

  test('rejects paths that escape the workspace', () => {
    expect(() => resolveWithinWorkspace(root, '..', 'outside')).toThrow(InvalidWorkspacePathError)
    expect(() => resolveWithinWorkspace(root, dirname(root))).toThrow(InvalidWorkspacePathError)
  })

  test('keeps project files inside projects/<project-id>', () => {
    expect(resolveProjectWorkspacePath(root, 'project-a', 'repositories', 'forgepilot-web')).toBe(
      join(normalizeWorkspaceRoot(root), 'projects', 'project-a', 'repositories', 'forgepilot-web'),
    )
    expect(() => resolveProjectWorkspacePath(root, 'project-a', '..', 'project-b')).toThrow(
      InvalidWorkspacePathError,
    )
    expect(() => resolveProjectWorkspacePath(root, '../project-a', 'repositories')).toThrow(
      InvalidWorkspacePathError,
    )
  })
})

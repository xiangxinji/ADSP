import { link, mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createAgentWorkspace } from '../server/services/agent-workspaces'
import { agentExcludedPath, agentProjectPath } from '../server/utils/agent-workspace'

let root: string
let repository: string
vi.mock('../server/services/local-workspace-settings', () => ({ requireLocalWorkspaceRoot: () => root }))

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'forgepilot-agent-workspace-'))
  repository = join(root, 'projects', 'project-1', 'repositories', 'example')
  await mkdir(repository, { recursive: true })
  await writeFile(join(repository, 'index.ts'), 'export const value = 1\n')
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
const snapshot = () => createAgentWorkspace('project-1', [{ assetId: 'repo-1', name: 'example', path: repository }])

describe('agent project filesystem boundary', () => {
  test('copies selected code only and leaves the source untouched until apply', async () => {
    await mkdir(join(repository, '.git'))
    await writeFile(join(repository, '.git', 'config'), 'private remote credential')
    await writeFile(join(repository, '.env.local'), 'SECRET=private')
    await writeFile(join(repository, '.npmrc'), '//registry/:_authToken=private')
    const workspace = await snapshot()
    const copy = join(workspace.directory, 'repositories', 'repo-1')
    expect(await readdir(copy)).toEqual(['index.ts'])
    await writeFile(join(copy, 'index.ts'), 'export const value = 2\n')
    expect(await readFile(join(repository, 'index.ts'), 'utf8')).toContain('value = 1')
    await workspace.dispose()
    expect(await readFile(join(repository, '.env.local'), 'utf8')).toBe('SECRET=private')
  })

  test('applies successful additions, edits and deletions without copying sensitive files', async () => {
    await writeFile(join(repository, 'remove.ts'), 'remove')
    const workspace = await snapshot()
    const copy = join(workspace.directory, 'repositories', 'repo-1')
    await writeFile(join(copy, 'index.ts'), 'changed')
    await writeFile(join(copy, 'new.ts'), 'added')
    await writeFile(join(copy, '.env'), 'must not copy')
    await unlink(join(copy, 'remove.ts'))
    await workspace.apply()
    expect(await readFile(join(repository, 'index.ts'), 'utf8')).toBe('changed')
    expect(await readdir(repository)).toEqual(['index.ts', 'new.ts'])
    await workspace.dispose()
  })

  test('preflights all modifications and does not overwrite concurrent user edits', async () => {
    const workspace = await snapshot()
    const copy = join(workspace.directory, 'repositories', 'repo-1')
    await writeFile(join(copy, 'new.ts'), 'agent addition')
    await writeFile(join(copy, 'index.ts'), 'agent edit')
    await writeFile(join(repository, 'index.ts'), 'user edit')
    await expect(workspace.apply()).rejects.toMatchObject({ data: { code: 'agent.workspace-conflict' } })
    expect(await readdir(repository)).toEqual(['index.ts'])
    expect(await readFile(join(repository, 'index.ts'), 'utf8')).toBe('user edit')
    await workspace.dispose()
  })

  test('rejects cross-project paths and traversal before copying', async () => {
    const other = join(root, 'projects', 'project-2')
    await mkdir(other)
    await expect(agentProjectPath(root, 'project-1', other)).rejects.toThrow()
    await expect(agentProjectPath(root, '../project-2')).rejects.toThrow()
    await expect(createAgentWorkspace('project-1', [{ assetId: 'repo-2', name: 'other', path: other }])).rejects.toMatchObject({ data: { code: 'agent.workspace-unavailable' } })
  })

  test('rejects directory junctions and hard-linked files', async () => {
    const other = join(root, 'projects', 'project-2')
    await mkdir(other)
    const junction = join(repository, 'outside')
    await symlink(other, junction, 'junction')
    await expect(snapshot()).rejects.toMatchObject({ data: { code: 'agent.workspace-unavailable' } })
    await unlink(junction)
    const privateFile = join(other, 'private.ts')
    await writeFile(privateFile, 'secret')
    await link(privateFile, join(repository, 'private.ts'))
    await expect(snapshot()).rejects.toMatchObject({ data: { code: 'agent.workspace-unavailable' } })
  })

  test('rejects agent-generated junctions before writing anything back', async () => {
    const workspace = await snapshot()
    const other = join(root, 'projects', 'project-2')
    await mkdir(other)
    await symlink(other, join(workspace.directory, 'repositories', 'repo-1', 'outside'), 'junction')
    await expect(workspace.apply()).rejects.toThrow()
    expect(await readdir(other)).toEqual([])
    await workspace.dispose()
  })

  test.each(['.env', 'src/.env.production', '.git/config', 'node_modules/foo/index.js', '.codex/config.toml', '.claude/settings.json', 'secret.pem', '.mcp.json'])('excludes %s', path => {
    expect(agentExcludedPath(path)).toBe(true)
  })
})

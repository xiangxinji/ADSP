import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const root = fileURLToPath(new URL('../', import.meta.url))
const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = join(directory, entry.name)
  return entry.isDirectory() ? sourceFiles(path) : /\.(ts|vue)$/.test(entry.name) ? [path] : []
})
const files = ['app', 'server', 'shared'].flatMap(directory => sourceFiles(join(root, directory)))
const projectPath = (path: string) => relative(root, path).replaceAll('\\', '/')
const imports = (source: string) => [...source.matchAll(
  /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]([^'"]+)['"]/g,
)].map(match => match[1]!)
const resolveImport = (file: string, specifier: string) => {
  if (specifier.startsWith('.')) return projectPath(resolve(dirname(file), specifier))
  if (specifier.startsWith('#shared/')) return `shared/${specifier.slice(8)}`
  if (/^(~~|@@)\//.test(specifier)) return specifier.slice(3)
  if (/^(~|@)\//.test(specifier)) return `app/${specifier.slice(2)}`
  return null
}
const backendDependencies: Record<string, string[]> = {
  api: ['services', 'validation', 'utils'],
  services: ['services', 'repositories', 'integrations', 'validation', 'utils', 'domain'],
  repositories: ['repositories', 'utils', 'domain'],
  integrations: ['integrations', 'utils', 'domain'],
  validation: ['validation', 'utils', 'domain'],
  utils: ['utils', 'domain'],
  domain: ['domain'],
}

describe('repository architecture constraints', () => {
  test('keeps every Vue component within 300 physical lines and 10 KiB', () => {
    const oversized = files.filter(file => file.endsWith('.vue')).flatMap(file => {
      const content = readFileSync(file)
      const source = content.toString('utf8')
      const lines = source.split(/\r?\n/).length - (source.endsWith('\n') ? 1 : 0)
      return lines > 300 || content.byteLength > 10 * 1024
        ? [`${projectPath(file)}: ${lines} lines, ${content.byteLength} bytes`] : []
    })
    expect(oversized).toEqual([])
  })

  test('reserves the component root for App primitives and groups domain UI in directories', () => {
    const misplaced = readdirSync(join(root, 'app/components'), { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.vue') && !/^App[A-Z]/.test(entry.name))
      .map(entry => entry.name)
    expect(misplaced).toEqual([])
  })

  test('keeps PascalCase component names and use-prefixed composable names', () => {
    const invalid = files.map(projectPath).filter(path => {
      const name = path.split('/').at(-1)!
      if (path.startsWith('app/components/') && name.endsWith('.vue')) return !/^[A-Z][A-Za-z0-9]*\.vue$/.test(name)
      if (path.startsWith('app/composables/') && name.endsWith('.ts')) return !/^use[A-Z][A-Za-z0-9]*\.ts$/.test(name)
      return false
    })
    expect(invalid).toEqual([])
  })

  test('enforces backend dependency direction and browser/server separation', () => {
    const violations: string[] = []
    for (const file of files) {
      const source = projectPath(file)
      const [sourceRoot, sourceLayer] = source.split('/')
      for (const specifier of imports(readFileSync(file, 'utf8'))) {
        const target = resolveImport(file, specifier)
        if (!target) continue
        const [targetRoot, targetLayer] = target.split('/')
        const crossesRuntime = sourceRoot === 'shared' && ['app', 'server'].includes(targetRoot!)
          || sourceRoot === 'app' && targetRoot === 'server'
          || sourceRoot === 'server' && targetRoot === 'app'
        const allowed = backendDependencies[sourceLayer!]
        const reversesLayer = sourceRoot === 'server' && targetRoot === 'server'
          && allowed && !allowed.includes(targetLayer!)
        const bypassesTransport = sourceRoot === 'server' && sourceLayer === 'api'
          && target.startsWith('server/utils/') && !/^server\/utils\/http-input(?:\.ts)?$/.test(target)
        if (crossesRuntime || reversesLayer || bypassesTransport) violations.push(`${source} → ${specifier}`)
      }
    }
    expect(violations).toEqual([])
  })

  test.each([
    "import type { Value } from '../shared/types/value'",
    "export { value } from '../shared/types/value'",
    "import '../shared/types/value'",
    "const module = import('../shared/types/value')",
    "const module = require('../shared/types/value')",
  ])('checks literal import forms: %s', source => {
    expect(imports(source)).toEqual(['../shared/types/value'])
  })
})

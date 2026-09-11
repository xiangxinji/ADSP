import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const args = process.argv.slice(2)
if (args[0] === 'rm') process.exit(0)
let prompt = ''
for await (const chunk of process.stdin) prompt += chunk
if (prompt.includes('MODE:runner-missing')) process.exit(125)
if (prompt.includes('MODE:timeout')) process.exit(124)
if (prompt.includes('MODE:failed')) process.exit(1)
if (prompt.includes('MODE:invalid')) { process.stdout.write('not-json'); process.exit(0) }
if (prompt.includes('MODE:oversized')) { process.stdout.write('x'.repeat(3 * 1024 * 1024)); process.exitCode = 0 }
if (prompt.includes('MODE:hang')) { setInterval(() => {}, 1000); await new Promise(() => {}) }
const mount = args[args.indexOf('--mount') + 1]
const directory = mount.match(/"source=(.*?)",target=/)?.[1]?.replaceAll('""', '"')
if (prompt.includes('MODE:write') && !mount.endsWith(',readonly')) {
  const repositories = await readdir(join(directory, 'repositories'))
  await writeFile(join(directory, 'repositories', repositories[0], 'agent-result.ts'), 'export const added = true\n')
}
const text = prompt.includes('MODE:echo-env')
  ? JSON.stringify({ credential: process.env.CODEX_API_KEY || process.env.ANTHROPIC_API_KEY, controlPlane: process.env.FORGEPILOT_CREDENTIAL_ENCRYPTION_KEY })
  : '调研完成\n' + prompt
if (args.includes('codex')) {
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text } }) + '\n')
  process.stdout.write(JSON.stringify({ type: 'turn.completed' }) + '\n')
} else {
  process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: text }))
}

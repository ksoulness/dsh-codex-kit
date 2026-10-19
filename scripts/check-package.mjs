#!/usr/bin/env node
import { readdir, readFile, lstat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const root = fileURLToPath(new URL('../', import.meta.url))
const ignored = new Set(['node_modules', '.git', '.local', '__pycache__'])
const failures = []
let count = 0
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(item.name)) continue
    const path = join(directory, item.name)
    const name = relative(root, path).replaceAll('\\', '/')
    if ((await lstat(path)).isSymbolicLink()) { failures.push(`Link forbidden: ${name}`); continue }
    if (item.isDirectory()) { await walk(path); continue }
    count++
    if (/^\.env(?:\.|$)/.test(item.name) || /(?:credentials|relay-token|relay-endpoint\.json|sessions?\.db|\.jsonl$)/i.test(item.name)) {
      failures.push(`Runtime or secret filename: ${name}`); continue
    }
    const text = await readFile(path, 'utf8')
    if (text.includes('\ufffd')) failures.push(`Invalid UTF-8: ${name}`)
    if (/C:[\\/]+Users[\\/]+Administrator|E:[\\/]+Code[\\/]+DSH|F:[\\/]+data[\\/]+CodexData|D:[\\/]+Program Files[\\/]+DSH|192\.168\.0\./i.test(text)) failures.push(`Machine-specific path/address: ${name}`)
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:ghp_|github_pat_)[A-Za-z0-9_]{25,}|sk-[A-Za-z0-9]{32,}/.test(text)) failures.push(`Potential secret: ${name}`)
    try {
      if (name.endsWith('.json') || item.name === '.mcp.json') JSON.parse(text)
      if (/\.ya?ml$/.test(name)) parse(text)
      if (item.name === 'SKILL.md' && name.startsWith('skills/')) {
        const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
        const meta = front ? parse(front[1]) : null
        if (!meta?.name || !meta.description || !name.startsWith(`skills/${meta.name}/`)) failures.push(`Invalid skill: ${name}`)
      }
    } catch { failures.push(`Invalid structured file: ${name}`) }
  }
}
await walk(root)
const portable = JSON.parse(await readFile(join(root, 'plugin.json'), 'utf8'))
const overlay = JSON.parse(await readFile(join(root, '.codex-plugin/plugin.json'), 'utf8'))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
if ([overlay, pkg].some(item => item.name !== portable.name || item.version !== portable.version)) failures.push('Plugin/package identities differ')
if (portable.extensions['com.openai'].interface.shortDescription.length > 30) failures.push('Plugin subtitle too long')
const marketplace = JSON.parse(await readFile(join(root, '.agents/plugins/marketplace.json'), 'utf8'))
const marketplacePlugin = marketplace.plugins?.find(item => item.name === portable.name)
if (!marketplacePlugin) failures.push('Codex marketplace does not list this plugin')
else if (marketplacePlugin.source?.source !== 'local' || marketplacePlugin.source?.path !== '.') failures.push('Codex marketplace must point at the repository root')
for (const file of ['vendor/harness-relay/LICENSE', 'vendor/harness-relay/dist/dsh-relay-proxy.mjs', 'vendor/harness-relay/dist/dsh-relay-harness.mjs', '.agents/plugins/marketplace.json', 'DSH-HANDOFF.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  try { await lstat(join(root, file)) } catch { failures.push(`Missing file: ${file}`) }
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1 }
else console.log(`Package checks passed: ${count} files; local data and dependencies excluded. Pattern checks do not prove absence of every possible secret.`)

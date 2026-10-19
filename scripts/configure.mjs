#!/usr/bin/env node
import { mkdir, stat, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { runtime } from './runtime.mjs'

export async function configure({ home, profile = 'web', output, node = process.execPath }) {
  runtime({ DSH_HOME: home, DSH_PROFILE: profile })
  if (!(await stat(home)).isDirectory()) throw new Error('DSH_HOME must be an existing directory')
  const root = fileURLToPath(new URL('../', import.meta.url))
  const directory = resolve(output ?? join(root, '.local'))
  const targets = ['mcp.json', 'codex-mcp.toml'].map(name => join(directory, name))
  for (const path of targets) {
    try { await access(path) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    throw new Error('Generated config already exists; choose a new --out directory')
  }
  const servers = Object.fromEntries([
    ['harness-relay-mcp', 'relay-proxy.mjs'], ['dsh-session-archive', 'session-archive-mcp.mjs'],
  ].map(([name, script]) => [name, {
    command: node, args: [join(root, 'scripts', script)], cwd: root,
    env: { DSH_HOME: home, DSH_PROFILE: profile, DSH_RELAY_AUTO_START: 'false' },
  }]))
  const quote = JSON.stringify
  const toml = Object.entries(servers).map(([name, value]) => {
    const table = `mcp_servers.${quote(name)}`
    return `[${table}]\ncommand = ${quote(value.command)}\nargs = ${quote(value.args)}\ncwd = ${quote(value.cwd)}\n[${table}.env]\n${Object.entries(value.env).map(([key, val]) => `${key} = ${quote(val)}`).join('\n')}\n`
  }).join('\n')
  await mkdir(directory, { recursive: true })
  await writeFile(targets[0], `${JSON.stringify({ mcpServers: servers }, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  await writeFile(targets[1], toml, { flag: 'wx', mode: 0o600 })
  return targets
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    const options = {}
    for (let i = 0; i < args.length; i += 2) {
      const name = args[i]
      if (!['--home', '--profile', '--out'].includes(name) || !args[i + 1] || args[i + 1].startsWith('--') || Object.hasOwn(options, name.slice(2))) throw new Error('Usage: npm run configure -- --home <absolute-DSH_HOME> [--profile web] [--out <directory>]')
      options[name.slice(2)] = args[i + 1]
    }
    const paths = await configure({ home: options.home, profile: options.profile, output: options.out })
    console.log(`Created ${paths.length} local configuration files. No host configuration was changed.`)
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}

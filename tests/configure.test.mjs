import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { configure } from '../scripts/configure.mjs'

test('configuration generation resolves paths and refuses existing outputs', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const directory = join(root, '.local', `configure-${randomUUID()}`)
  const home = join(directory, 'mock-home')
  await mkdir(home, { recursive: true })
  const files = await configure({ home, output: directory })
  const config = JSON.parse(await readFile(files[0], 'utf8'))
  assert.deepEqual(Object.keys(config.mcpServers).sort(), ['dsh-session-archive', 'harness-relay-mcp'])
  for (const server of Object.values(config.mcpServers)) {
    assert.equal(server.command, process.execPath)
    assert.equal(server.env.DSH_HOME, home)
    assert.equal(server.env.DSH_RELAY_AUTO_START, 'false')
    assert.equal(server.cwd, root)
  }
  const toml = await readFile(files[1], 'utf8')
  assert.ok(toml.includes('[mcp_servers."harness-relay-mcp".env]'))
  await assert.rejects(configure({ home, output: directory }), /already exists/)
  assert.deepEqual(JSON.parse(await readFile(files[0], 'utf8')), config)
})

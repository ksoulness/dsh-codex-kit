import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'

test('archive MCP discovers one tool and rejects invalid calls without filesystem access', async () => {
  const env = { ...process.env }
  delete env.DSH_HOME
  const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/session-archive-mcp.mjs', import.meta.url))], { windowsHide: true, env, stdio: ['pipe', 'pipe', 'pipe'] })
  const rows = []
  let stderr = ''
  child.stderr.on('data', chunk => { stderr += chunk })
  const done = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => resolve(code)) })
  const timer = setTimeout(() => child.kill(), 10_000)
  const input = createInterface({ input: child.stdout })
  const collect = (async () => { for await (const line of input) rows.push(JSON.parse(line)) })()
  const send = (id, method, params) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) })}\n`)
  send(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } })
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)
  send(2, 'tools/list')
  send(3, 'tools/call', { name: 'archive_terminal_session', arguments: { sessionId: 'partial' } })
  send(4, 'tools/call', { name: 'archive_terminal_session', arguments: { sessionId: 'session-11111111-1111-4111-8111-111111111111', extra: true } })
  send(5, 'ping')
  child.stdin.end()
  try {
    assert.equal(await done, 0)
    await collect
    assert.equal(stderr, '')
    assert.equal(rows.length, 5)
    assert.equal(rows[0].result.serverInfo.name, 'dsh-session-archive')
    assert.equal(rows[1].result.tools.length, 1)
    assert.equal(rows[1].result.tools[0].name, 'archive_terminal_session')
    for (const row of rows.slice(2, 4)) assert.equal(row.result.isError, true)
    assert.deepEqual(rows[4].result, {})
  } finally { clearTimeout(timer) }
})

test('bundled Relay proxy initializes and lists native tools with an unavailable mock Host', async () => {
  const home = fileURLToPath(new URL('../.local/empty-host/', import.meta.url))
  await mkdir(home, { recursive: true })
  const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/relay-proxy.mjs', import.meta.url))], {
    windowsHide: true, env: { ...process.env, DSH_HOME: home }, stdio: ['pipe', 'pipe', 'pipe'],
  })
  const input = createInterface({ input: child.stdout })
  const rows = []
  const done = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => resolve(code)) })
  const timer = setTimeout(() => child.kill(), 10_000)
  const collect = (async () => { for await (const line of input) rows.push(JSON.parse(line)) })()
  child.stderr.resume()
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'kit-test', version: '1' } } })}\n`)
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`)
  child.stdin.end()
  try {
    assert.equal(await done, 0)
    await collect
    assert.ok(rows.find(row => row.id === 1)?.result.serverInfo)
    const names = rows.find(row => row.id === 2)?.result.tools.map(tool => tool.name)
    for (const name of ['doctor', 'list_capabilities', 'start_review', 'wait_run']) assert.ok(names?.includes(name), name)
  } finally { clearTimeout(timer) }
})

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

test('packaged proxy starts without external MCP SDK dependencies or a running Host', () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const result = spawnSync(process.execPath, [join(root, 'dist/dsh-relay-proxy.mjs')], {
    cwd: root,
    env: {
      SystemRoot: process.env.SystemRoot ?? 'C:\\Windows',
      DSH_HOME: join(root, 'unused-test-home'),
      DSH_RELAY_AUTO_START: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    encoding: 'utf8',
    timeout: 5000,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
})

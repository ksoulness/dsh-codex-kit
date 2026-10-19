#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runtime } from './runtime.mjs'

try {
  runtime()
  const entry = fileURLToPath(new URL('../vendor/harness-relay/dist/dsh-relay-proxy.mjs', import.meta.url))
  const child = spawn(process.execPath, [entry], {
    stdio: 'inherit', windowsHide: true,
    env: { ...process.env, DSH_RELAY_AUTO_START: 'false' },
  })
  child.once('error', () => { process.stderr.write('Unable to start bundled Relay proxy\n'); process.exitCode = 1 })
  child.once('exit', code => { process.exitCode = code ?? 1 })
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal))
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}

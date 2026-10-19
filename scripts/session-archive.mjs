#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { runtime, loopbackUrl } from './runtime.mjs'

export const SESSION_ID = /^session-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

export async function archiveSession(sessionId, { env = process.env, read = readFile, fetchImpl = fetch, action = 'archive' } = {}) {
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) throw new Error('A full session-UUID is required')
  if (!['archive', 'unarchive'].includes(action)) throw new Error('Invalid action')
  const { home, descriptor: descriptorPath } = runtime(env)
  const descriptor = JSON.parse(await read(descriptorPath, 'utf8'))
  if (descriptor.schemaVersion !== 1 || descriptor.mode !== 'embedded') throw new Error('Invalid embedded Relay descriptor')
  const host = loopbackUrl(descriptor.hostWebUrl)
  const document = parse(await read(join(home, '.credentials.yaml'), 'utf8'))
  const record = document?.records?.['client-connection/browser-session']
  const secretText = record?.payload?.secret
  if (record?.kind !== 'grant' || typeof secretText !== 'string' || !/^[A-Za-z0-9_-]{43}=?$/.test(secretText)) {
    throw new Error('Missing or invalid local browser-session grant')
  }
  const secret = Buffer.from(secretText, 'base64url')
  if (secret.byteLength !== 32) throw new Error('Invalid local browser-session grant length')
  const authority = new URL(host).host
  const issuedAt = Date.now()
  const body = Buffer.from(JSON.stringify({ version: 1, authority, issuedAt, expiresAt: issuedAt + 60_000 })).toString('base64url')
  const name = `dsh-auth-${createHash('sha256').update(authority).digest('base64url')}`
  const cookie = `${name}=v1.${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
  const method = action === 'archive' ? 'workspace/archiveSession' : 'workspace/unarchiveSession'
  let response
  try {
    response = await fetchImpl(`${host}/api/${method}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ type: 'client-request', rpcId: randomUUID(), method, payload: { args: { request: { sessionId } } } }),
    })
  } catch {
    throw new Error('DSH archive request failed or timed out; do not assume success')
  }
  // Never include response bodies or authentication data in errors.
  if (response.status !== 200) throw new Error(`DSH archive HTTP ${response.status}`)
  let message
  try { message = await response.json() } catch { throw new Error('Invalid DSH archive response') }
  const result = message?.result
  if (result?.ok !== true) return {
    sessionId, archived: false, state: 'archive_pending',
    errorCode: typeof result?.error?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(result.error.code) ? result.error.code : 'HOST_REJECTED',
  }
  return { sessionId, archived: action === 'archive', ...(action === 'unarchive' ? { restored: true } : {}) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, flag, sessionId, apply, ...extra] = process.argv.slice(2)
  if (!['archive', 'unarchive'].includes(action) || flag !== '--session' || !SESSION_ID.test(sessionId ?? '') || apply !== '--apply' || extra.length) {
    process.stderr.write('Usage: node scripts/session-archive.mjs <archive|unarchive> --session <full-session-UUID> --apply\n')
    process.exitCode = 1
  } else {
    try {
      const result = await archiveSession(sessionId, { action })
      process.stdout.write(`${JSON.stringify(result)}\n`)
      if (!(result.archived || result.restored)) process.exitCode = 1
    } catch {
      process.stderr.write('Archive operation failed; no success confirmed. Check local configuration and Host compatibility.\n')
      process.exitCode = 1
    }
  }
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { isAbsolute, join } from 'node:path'
import { archiveSession } from '../scripts/session-archive.mjs'
import { loopbackUrl, runtime } from '../scripts/runtime.mjs'

const id = 'session-11111111-1111-4111-8111-111111111111'
const home = process.cwd()
const secret = Buffer.alloc(32, 7)
function harness(host = 'http://127.0.0.1:41999/', ok = true) {
  const reads = []
  const calls = []
  return {
    reads, calls, env: { DSH_HOME: home },
    read: async path => {
      reads.push(path)
      if (path.endsWith('relay-endpoint.json')) return JSON.stringify({ schemaVersion: 1, mode: 'embedded', hostWebUrl: host })
      assert.equal(path, join(home, '.credentials.yaml'))
      return `records:\n  client-connection/browser-session:\n    kind: grant\n    payload:\n      secret: ${secret.toString('base64url')}\n`
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return { status: 200, json: async () => ({ result: ok ? { ok: true } : { ok: false, error: { code: 'SESSION_ACTIVE', message: 'private host detail' } } }) }
    },
  }
}
test('exact archive uses descriptor port, expected RPC, authenticated request and structured result', async () => {
  const mock = harness()
  assert.deepEqual(await archiveSession(id, mock), { sessionId: id, archived: true })
  assert.equal(mock.reads.length, 2)
  const { url, options } = mock.calls[0]
  assert.equal(url, 'http://127.0.0.1:41999/api/workspace/archiveSession')
  assert.equal(options.redirect, 'error')
  const envelope = JSON.parse(options.body)
  assert.equal(envelope.method, 'workspace/archiveSession')
  assert.deepEqual(envelope.payload.args.request, { sessionId: id })
  const [, body, signature] = options.headers.cookie.split('=')[1].split('.')
  assert.equal(signature, createHmac('sha256', secret).update(body).digest('base64url'))
  const grant = JSON.parse(Buffer.from(body, 'base64url'))
  assert.equal(grant.authority, '127.0.0.1:41999')
  assert.equal(grant.expiresAt - grant.issuedAt, 60_000)
})
test('invalid, partial and multiple IDs never read credentials or issue requests', async () => {
  for (const input of ['11111111', id.slice(8), `${id},${id}`, null]) {
    const mock = harness()
    await assert.rejects(archiveSession(input, mock), /full session-UUID/)
    assert.equal(mock.reads.length, 0)
    assert.equal(mock.calls.length, 0)
  }
})
test('remote or redirected origins are rejected before credentials are read', async () => {
  for (const url of ['https://example.com/', 'http://192.0.2.1/', 'http://127.0.0.1/?token=example', 'http://user:pass@localhost/', 'http://localhost/api']) {
    const mock = harness(url)
    await assert.rejects(archiveSession(id, mock), /loopback HTTP/)
    assert.equal(mock.reads.length, 1)
    assert.equal(mock.calls.length, 0)
  }
  assert.equal(loopbackUrl('http://[::1]:4000/'), 'http://[::1]:4000')
})
test('active Host refusal is archive_pending without raw response details', async () => {
  const result = await archiveSession(id, harness(undefined, false))
  assert.deepEqual(result, { sessionId: id, archived: false, state: 'archive_pending', errorCode: 'SESSION_ACTIVE' })
  assert.ok(!JSON.stringify(result).includes('private host detail'))
})
test('HTTP errors and transport exceptions do not leak response or request data', async () => {
  const mock = harness()
  mock.fetchImpl = async () => ({ status: 401, text: async () => 'private response' })
  await assert.rejects(archiveSession(id, mock), /^Error: DSH archive HTTP 401$/)
  mock.fetchImpl = async () => { throw new Error('request cookie private') }
  await assert.rejects(archiveSession(id, mock), error => !error.message.includes('cookie'))
  mock.fetchImpl = async () => ({ status: 200, json: async () => ({}) })
  assert.equal((await archiveSession(id, mock)).archived, false)
})
test('runtime requires an absolute home and contained profile', () => {
  assert.ok(isAbsolute(home))
  for (const profile of ['..', '../web', 'a/b', '']) assert.throws(() => runtime({ DSH_HOME: home, DSH_PROFILE: profile }))
  assert.throws(() => runtime({ DSH_HOME: 'relative' }))
})

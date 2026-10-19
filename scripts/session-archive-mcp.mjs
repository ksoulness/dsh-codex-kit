#!/usr/bin/env node
import { createInterface } from 'node:readline'
import { archiveSession } from './session-archive.mjs'

const send = value => process.stdout.write(`${JSON.stringify(value)}\n`)
const tool = {
  name: 'archive_terminal_session',
  description: '归档本父任务通过 Relay fresh 创建、已消费终态结果且没有活动运行的精确会话。来源与终态由调用方核验，Host 必须允许归档。',
  inputSchema: {
    type: 'object', properties: { sessionId: { type: 'string', pattern: '^session-[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$' } },
    required: ['sessionId'], additionalProperties: false,
  },
}
const result = (value, failed = false) => ({ content: [{ type: 'text', text: JSON.stringify(value) }], ...(failed ? { isError: true } : {}) })
const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of input) {
  let request
  try { request = JSON.parse(line) } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); continue }
  if (!request || typeof request !== 'object' || Array.isArray(request) || request.jsonrpc !== '2.0') {
    send({ jsonrpc: '2.0', id: request?.id ?? null, error: { code: -32600, message: 'Invalid request' } }); continue
  }
  if (request.id === undefined) continue
  const reply = body => send({ jsonrpc: '2.0', id: request.id, ...body })
  if (request.method === 'initialize') {
    reply({ result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'dsh-session-archive', version: '0.1.0' } } })
  } else if (request.method === 'ping') reply({ result: {} })
  else if (request.method === 'tools/list') reply({ result: { tools: [tool] } })
  else if (request.method === 'tools/call') {
    const args = request.params?.arguments
    if (request.params?.name !== tool.name || !args || Object.keys(args).length !== 1 || typeof args.sessionId !== 'string') {
      reply({ result: result({ archived: false, errorCode: 'INVALID_ARGUMENTS' }, true) }); continue
    }
    try {
      const value = await archiveSession(args.sessionId)
      reply({ result: result(value, !value.archived) })
    } catch {
      reply({ result: result({ archived: false, state: 'archive_pending', errorCode: 'ARCHIVE_FAILED' }, true) })
    }
  } else reply({ error: { code: -32601, message: 'Method not found' } })
}

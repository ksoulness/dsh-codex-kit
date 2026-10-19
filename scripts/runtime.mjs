import { isAbsolute, join } from 'node:path'

export function runtime(env = process.env) {
  const home = env.DSH_HOME
  if (typeof home !== 'string' || !isAbsolute(home)) throw new Error('DSH_HOME must be an absolute local path')
  const profile = env.DSH_PROFILE ?? 'web'
  if (!/^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(profile)) throw new Error('Invalid DSH_PROFILE')
  return { home, profile, descriptor: join(home, 'plugins', 'dsh-relay', profile, 'relay-endpoint.json') }
}

export function loopbackUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('DSH host must be a loopback HTTP origin without credentials, query or fragment')
  }
  return url.origin
}

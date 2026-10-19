#!/usr/bin/env node
import { build } from 'esbuild'
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, dirname, resolve } from 'node:path'

const source = fileURLToPath(new URL('../vendor/harness-relay/', import.meta.url))
const { version } = JSON.parse(await readFile(join(source, 'version.json'), 'utf8'))
const check = process.argv.includes('--check')
const dependencies = new Map()
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Only --check is supported')
if (!check) await mkdir(join(source, 'dist'), { recursive: true })
for (const [entry, output, executable] of [
  ['index.ts', 'dsh-relay.mjs', true],
  ['proxy-index.ts', 'dsh-relay-proxy.mjs', true],
  ['harness-entry.ts', 'dsh-relay-harness.mjs', false],
]) {
  const result = await build({
    absWorkingDir: source, entryPoints: [`src/${entry}`],
    bundle: true, platform: 'node', format: 'esm', target: 'node22', minify: true,
    sourcemap: false, write: false, legalComments: 'eof', metafile: true,
    define: { __DSH_RELAY_VERSION__: JSON.stringify(version) },
    ...(executable ? { banner: { js: '#!/usr/bin/env node' } } : {}),
    external: ['@deepseek-ai/cordis', '@deepseek-ai/schemastery'],
  })
  const path = join(source, 'dist', output)
  const bytes = result.outputFiles[0].contents
  if (check) {
    if (!Buffer.from(bytes).equals(await readFile(path))) throw new Error(`Build differs: ${output}`)
  } else {
    await writeFile(path, bytes)
  }
  for (const input of Object.keys(result.metafile.inputs)) {
    if (!input.includes('node_modules/')) continue
    let directory = dirname(resolve(source, input))
    while (directory !== dirname(directory)) {
      try {
        const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
        if (pkg.name && pkg.version) { dependencies.set(`${pkg.name}@${pkg.version}`, { directory, pkg }); break }
      } catch (error) { if (error.code !== 'ENOENT') throw error }
      directory = dirname(directory)
    }
  }
}
const notices = fileURLToPath(new URL('../licenses/', import.meta.url))
if (!check) await mkdir(notices, { recursive: true })
const list = []
for (const [id, { directory, pkg }] of [...dependencies].sort(([a], [b]) => a.localeCompare(b))) {
  const name = `${pkg.name.replace(/[^a-zA-Z0-9.-]/g, '_')}.txt`
  const entries = (await readdir(directory)).filter(file => /^(LICENSE|LICENCE|COPYING)(?:[.-].*)?$/i.test(file))
  if (!entries.length) throw new Error(`No license found for ${id}`)
  const text = `${id}\nLicense: ${pkg.license ?? 'see below'}\n\n${(await Promise.all(entries.sort().map(file => readFile(join(directory, file), 'utf8')))).join('\n\n')}`
  const path = join(notices, name)
  if (check) {
    if (text !== await readFile(path, 'utf8')) throw new Error(`License differs: ${id}`)
  } else await writeFile(path, text, 'utf8')
  list.push({ name: pkg.name, version: pkg.version, license: pkg.license ?? null, file: `licenses/${name}` })
}
const record = `${JSON.stringify({ relayVersion: version, packages: list }, null, 2)}\n`
const info = fileURLToPath(new URL('../licenses/bundled-dependencies.json', import.meta.url))
if (check) {
  if (record !== await readFile(info, 'utf8')) throw new Error('Bundled dependency record differs')
} else await writeFile(info, record, 'utf8')
console.log(check ? 'Relay build matches source' : `Built Relay ${version}`)

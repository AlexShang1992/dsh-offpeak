/**
 * CI artifact smoke test: assert the built package is loadable and shaped
 * correctly. Runs only after `pnpm run build`.
 */
import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = false

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failed = true
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('Verifying dsh-offpeak artifacts…')

// 1. Host entry: named ESM plugin with name/inject/apply.
const host = join(root, 'lib/index.js')
check('lib/index.js exists', existsSync(host))
if (existsSync(host)) {
  const mod = await import(`${host}?t=${Date.now()}`)
  check('host exports name', mod.name === 'dsh-offpeak', String(mod.name))
  check('host exports apply', typeof mod.apply === 'function')
  check('host exports inject', Array.isArray(mod.inject))
  const required = ['settings', 'typert']
  check('host inject lists all services', required.every(s => mod.inject.includes(s)), mod.inject.join(','))
}

// 2. Client bundle: CJS wrapped in the ModuleLoader handshake, served id.
const client = join(root, 'lib/client.js')
check('lib/client.js exists', existsSync(client))
if (existsSync(client)) {
  const source = readFileSync(client, 'utf8')
  check('client bundle uses the ModuleLoader handshake', source.includes('window.__ModuleLoader__.load'))
  check('client bundle id is dsh-offpeak', source.includes("id: 'dsh-offpeak'"))
}

// 3. Declarations.
check('lib/types/index.d.ts exists', existsSync(join(root, 'lib/types/index.d.ts')))
check('lib/types/client/index.d.ts exists', existsSync(join(root, 'lib/types/client/index.d.ts')))

// 4. package.json export map lines up with the artifacts.
const require_ = createRequire(import.meta.url)
const pkg = require_(join(root, 'package.json'))
check('exports["."].default → lib/index.js', pkg.exports['.'].default === './lib/index.js')
check('exports["./client"].default → lib/client.js', pkg.exports['./client'].default === './lib/client.js')
check('dsh.bundle.patch → cordis.patch.yml', pkg.dsh?.bundle?.patch === './cordis.patch.yml')
check('dsh.client.platform is web', pkg.dsh?.client?.platform === 'web')
check('cordis.patch.yml exists', existsSync(join(root, 'cordis.patch.yml')))
check('LICENSE exists', existsSync(join(root, 'LICENSE')))

if (failed) {
  console.error('\nArtifact verification FAILED.')
  process.exit(1)
}
console.log('\nAll artifact checks passed.')

/**
 * dsh-offpeak host plugin: the off-peak cost autopilot for DeepSeek Harness.
 *
 * Mounts the `offpeak` Typert Remote service (status/settings/queue/ledger
 * for the browser), registers its strict Typert manifest, registers the
 * `offpeak` settings namespace (live-applied), and exposes model tools
 * (`offpeak_status` / `offpeak_estimate` / `offpeak_defer` / `offpeak_queue`)
 * plus slash commands (`/offpeak`, `/defer`). The client half ships in the
 * same package (`./client`); the web server serves it under
 * `/plugins/dsh-offpeak/client.js`.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// Type-only: brings the `ctx.typert` Context merge into this program.
import type {} from '@deepseek-ai/dsh-typert-registry'
// Type-only: brings the `ctx.settings`, `ctx.tools`, `ctx.commands` merges.
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-commands'
import { OffpeakStore, defaultStoreDir } from './store.ts'
import { registerOffpeakSettings } from './settings.ts'
import { TYPERT_MANIFEST } from './typert.ts'
import { OffpeakRuntime } from './runtime.ts'
import { registerTools } from './tools.ts'
import { registerCommands } from './commands.ts'

/** Cordis plugin name (the Loader entry and client bundle id). */
export const name = 'dsh-offpeak'

/** Services required before load: tools, settings, commands, and the Typert registry. */
export const inject = ['tools', 'settings', 'commands', 'typert']

/** Host plugin configuration, validated at load by the Loader. */
export interface Config {
  /** Storage directory for the queue and ledger (defaults to $DSH_HOME/offpeak). */
  storeDir?: string
}

/** Configuration schema: deployment-varying bounds stay tunable from the profile patch. */
export const Config = z.object({
  storeDir: z.string().default(defaultStoreDir()),
})

/**
 * Mount the off-peak service, tools, commands, and the Typert manifest.
 * @param ctx - host cordis context.
 * @param config - validated plugin configuration (schema defaults applied).
 */
export function apply(ctx: Context, config?: Config): void {
  const resolved: Config = Config(config ?? {})
  const settings = registerOffpeakSettings(ctx)
  const store = new OffpeakStore(resolved.storeDir ?? defaultStoreDir())
  const runtime = new OffpeakRuntime(ctx, store, settings)

  // Strict endpoint registration: the gateway resolves offpeak/<method> from
  // this manifest, independent of decorator marker state.
  ctx.effect(() => {
    const dispose = ctx.typert.register(TYPERT_MANIFEST)
    return () => { void dispose() }
  }, 'dsh-offpeak: typert manifest')

  registerTools(ctx, runtime)
  registerCommands(ctx, runtime)

  // Record the starting window so switch reminders fire only on real changes.
  runtime.noteWindowSwitch(new Date())
}

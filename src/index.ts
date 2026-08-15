/**
 * dsh-offpeak host plugin: peak/off-peak pricing awareness for the DeepSeek
 * Harness Web GUI.
 *
 * The host half is deliberately small. It registers the `offpeak` settings
 * namespace (live-applied) and mounts the `offpeak` Typert Remote service so
 * the browser can read and write those settings; everything the user sees is
 * derived in the browser from the same pure pricing engine. The plugin owns
 * no durable state of its own, registers no tools or commands, and makes no
 * network calls.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: brings the `ctx.typert` Context merge into this program.
import type {} from '@deepseek-ai/dsh-typert-registry'
// Type-only: brings the `ctx.settings` merge.
import type {} from '@deepseek-ai/dsh-settings'
import { registerOffpeakSettings } from './settings.ts'
import { TYPERT_MANIFEST } from './typert.ts'
import { OffpeakRuntime } from './runtime.ts'

/** Cordis plugin name (the Loader entry and client bundle id). */
export const name = 'dsh-offpeak'

/** Services required before load: the settings provider and the Typert registry. */
export const inject = ['settings', 'typert']

/**
 * Mount the off-peak settings namespace and its Remote service.
 * @param ctx - host cordis context.
 */
export function apply(ctx: Context): void {
  const settings = registerOffpeakSettings(ctx)

  // Constructing the service is what mounts it: TypertRemoteService binds the
  // `offpeak` key on this context and to the Typert Gateway, and the plugin
  // scope disposes it again. Nothing in the host reads the instance back.
  // eslint-disable-next-line no-new -- the constructor is the registration
  new OffpeakRuntime(ctx, settings)

  // Strict endpoint registration: the gateway resolves offpeak/<method> from
  // this manifest, independent of decorator marker state.
  ctx.effect(() => {
    const dispose = ctx.typert.register(TYPERT_MANIFEST)
    return () => { void dispose() }
  }, 'dsh-offpeak: typert manifest')
}

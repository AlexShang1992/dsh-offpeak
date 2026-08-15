/**
 * dsh-offpeak client plugin: the browser half, and the only half a user sees.
 * It mounts the offpeak Remote namespace, keeps one live settings snapshot,
 * registers the composer-dock status pill and the Off-peak settings section,
 * and ships the zh/en dictionaries. The host owns the durable settings; this
 * half reads and writes them through the Remote and derives everything else
 * locally from the shared pricing engine.
 */
// Type-only: the ctx.remote merge and the forwarded Host-event face.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the composer-dock SlotMap merge for the pill seat.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: brings the settings.section SlotMap declaration into this program.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the ctx.locale Context merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { OffpeakSettingsUpdate } from '../contract.ts'
import { defaultOffpeakSettings } from '../defaults.ts'
import { OffpeakPill, type OffpeakPillInjected } from './OffpeakPill.tsx'
import { OffpeakSection, type OffpeakSectionInjected } from './OffpeakSettings.tsx'
import { NS, en, zh } from './locales.ts'
import { OFFPEAK_REMOTE, type OffpeakRemoteFace } from './remote.ts'
import { adoptStyles } from './styles.ts'

/** Required services: Remote face, slots, locale, sessions, and the connection carrier. */
export const inject = ['remote', 'slots', 'locale', 'sessions', 'connection']

/** Compose the off-peak surface. */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-offpeak: dictionaries')

  const settingsScope = createSnapshotStore({ value: defaultOffpeakSettings() })

  // The mounted namespace handle resolves through the service store
  // (`ctx.reflect.get`), not through `ctx.remote.offpeak`: the generated-style
  // dotted read walks the cordis fiber chain, which stops at the Loader's
  // runtime-less internal forks between a plugin entry and the root fiber —
  // the namespace service mounted under the gateway entry is unreachable
  // that way (the store path resolves it by isolation label instead).
  let offpeak: OffpeakRemoteFace | undefined

  const loadSettings = async (): Promise<void> => {
    const remote = offpeak
    if (remote === undefined) return
    try {
      const result = await remote.getSettings()
      if (!result.ok) {
        console.error(`[dsh-offpeak] settings read failed: ${result.error.code}: ${result.error.message}`)
        return
      }
      settingsScope.set({ value: result.value })
    } catch (error) {
      console.error('[dsh-offpeak] settings read failed:', error)
    }
  }

  // Serialized settings writes: one in flight at a time, latest wins.
  let updateTail: Promise<void> = Promise.resolve()
  const updateField = (field: string, value: unknown): Promise<void> => {
    const operation = updateTail.then(async () => {
      const remote = offpeak
      if (remote === undefined) {
        console.error('[dsh-offpeak] update failed: the offpeak Remote is not mounted')
        return
      }
      const update = { field, value } as OffpeakSettingsUpdate
      const result = await remote.updateSettings(update)
      if (!result.ok) {
        console.error(`[dsh-offpeak] settings update failed: ${result.error.code}: ${result.error.message}`)
        return
      }
      settingsScope.set({ value: result.value })
    })
    updateTail = operation.catch(() => {})
    return operation
  }

  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(OFFPEAK_REMOTE)
    offpeak = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.offpeak') as OffpeakRemoteFace | undefined
    if (offpeak === undefined) {
      throw new Error('dsh-offpeak: the offpeak Remote namespace did not mount')
    }
    await loadSettings()
    return () => {
      offpeak = undefined
      void dispose()
    }
  }, 'dsh-offpeak: remote')

  // Reconnect may have rebuilt the host: cached state dies with it.
  ctx.on('connection/reset', () => {
    void loadSettings()
  })

  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'offpeak',
    order: 40,
    locale: NS,
    inject: (): OffpeakPillInjected => ({
      hooks: { settings: settingsScope },
    }),
  }, OffpeakPill))

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'offpeak',
    order: 40,
    label: () => ctx.locale.bind(NS)('settings.title'),
    locale: NS,
    inject: (): OffpeakSectionInjected => ({
      hooks: { settings: settingsScope },
      updateField,
    }),
  }, OffpeakSection))
}

/**
 * dsh-offpeak client plugin: the browser half of the off-peak cost
 * autopilot. Mounts the offpeak Remote namespace, keeps live settings/queue/
 * ledger snapshot stores, registers the composer-dock status pill and the
 * Off-peak settings section, and ships the zh/en dictionaries. The Host owns
 * the pricing truth; this half only reads and writes through the Remote.
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
import type { LedgerEntry, OffpeakSettings, OffpeakSettingsUpdate, QueueEntry } from '../contract.ts'
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
  const queueScope = createSnapshotStore({ value: [] as QueueEntry[] })
  const ledgerScope = createSnapshotStore({ value: [] as LedgerEntry[] })

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

  const loadQueue = async (): Promise<void> => {
    const remote = offpeak
    if (remote === undefined) return
    try {
      const result = await remote.getQueue()
      if (!result.ok) {
        console.error(`[dsh-offpeak] queue read failed: ${result.error.code}: ${result.error.message}`)
        return
      }
      queueScope.set({ value: result.value })
    } catch (error) {
      console.error('[dsh-offpeak] queue read failed:', error)
    }
  }

  const loadLedger = async (): Promise<void> => {
    const remote = offpeak
    if (remote === undefined) return
    try {
      const result = await remote.getLedger(200)
      if (!result.ok) {
        console.error(`[dsh-offpeak] ledger read failed: ${result.error.code}: ${result.error.message}`)
        return
      }
      ledgerScope.set({ value: result.value })
    } catch (error) {
      console.error('[dsh-offpeak] ledger read failed:', error)
    }
  }

  const reload = async (): Promise<void> => {
    await Promise.all([loadSettings(), loadQueue(), loadLedger()])
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

  const cancelQueue = async (id: string): Promise<void> => {
    const remote = offpeak
    if (remote === undefined) return
    const result = await remote.cancelQueue(id)
    if (!result.ok) {
      console.error(`[dsh-offpeak] queue cancel failed: ${result.error.code}: ${result.error.message}`)
      return
    }
    queueScope.set({ value: result.value })
  }

  const clearLedger = async (): Promise<void> => {
    const remote = offpeak
    if (remote === undefined) return
    const result = await remote.clearLedger()
    if (!result.ok) {
      console.error(`[dsh-offpeak] ledger clear failed: ${result.error.code}: ${result.error.message}`)
      return
    }
    ledgerScope.set({ value: [] })
  }

  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(OFFPEAK_REMOTE)
    offpeak = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.offpeak') as OffpeakRemoteFace | undefined
    if (offpeak === undefined) {
      throw new Error('dsh-offpeak: the offpeak Remote namespace did not mount')
    }
    await reload()
    return () => {
      offpeak = undefined
      void dispose()
    }
  }, 'dsh-offpeak: remote')

  // Reconnect may have rebuilt the host: cached state dies with it.
  ctx.on('connection/reset', () => {
    void reload()
  })

  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'offpeak',
    order: 40,
    locale: NS,
    inject: (): OffpeakPillInjected => ({
      hooks: { settings: settingsScope, queue: queueScope, ledger: ledgerScope },
    }),
  }, OffpeakPill))

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'offpeak',
    order: 40,
    label: () => ctx.locale.bind(NS)('settings.title'),
    locale: NS,
    inject: (): OffpeakSectionInjected => ({
      hooks: { settings: settingsScope, queue: queueScope, ledger: ledgerScope },
      updateField,
      cancelQueue,
      clearLedger,
      reload,
    }),
  }, OffpeakSection))
}

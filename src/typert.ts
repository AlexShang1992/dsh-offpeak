/**
 * The hand-written host Typert manifest for the offpeak Remote. Registered
 * through `ctx.typert.register` in the plugin body, it claims the wire
 * endpoints through the strict registry — the same path generated `./typert`
 * artifacts use — so the Host Gateway resolves offpeak calls without
 * consulting the `@Remote` marker table. That marker independence matters in
 * the harness's source-launch development environment, where the tsx-loaded
 * gateway and a profile-loaded plugin bundle can hold separate copies of the
 * decorator module state.
 */
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry/types'
import { OFFPEAK_INVOCATIONS } from './contract.ts'

/** The offpeak namespace's host manifest (strict codecs shared with the client). */
export const TYPERT_MANIFEST: TypertContribution = {
  package: 'dsh-offpeak',
  face: 'host',
  schemas: [],
  model: {
    services: [
      {
        key: 'offpeak',
        exportName: 'OffpeakRuntime',
        description: 'Off-peak pricing status, durable settings, the defer queue, and the savings ledger.',
        tags: [],
        members: [
          { kind: 'method', name: 'getStatus', signature: 'getStatus(): OffpeakStatus' },
          { kind: 'method', name: 'getSettings', signature: 'getSettings(): OffpeakSettings' },
          { kind: 'method', name: 'updateSettings', signature: 'updateSettings(update: OffpeakSettingsUpdate): Promise<OffpeakSettings>' },
          { kind: 'method', name: 'getQueue', signature: 'getQueue(): QueueEntry[]' },
          { kind: 'method', name: 'cancelQueue', signature: 'cancelQueue(id: string): QueueEntry[]' },
          { kind: 'method', name: 'getLedger', signature: 'getLedger(limit: number): LedgerEntry[]' },
          { kind: 'method', name: 'clearLedger', signature: 'clearLedger(): number' },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
  invocations: OFFPEAK_INVOCATIONS,
}

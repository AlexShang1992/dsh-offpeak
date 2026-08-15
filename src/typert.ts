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
        description: 'Durable peak/off-peak pricing preferences.',
        tags: [],
        members: [
          { kind: 'method', name: 'getSettings', signature: 'getSettings(): OffpeakSettings' },
          { kind: 'method', name: 'updateSettings', signature: 'updateSettings(update: OffpeakSettingsUpdate): Promise<OffpeakSettings>' },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
  invocations: OFFPEAK_INVOCATIONS,
}

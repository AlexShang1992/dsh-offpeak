/**
 * Client-side structural face of the `offpeak` Remote namespace. The host
 * service (`OffpeakRuntime`) declares the same methods; the wire contract is
 * validated by the strict Typert invocation descriptors in contract.ts, and
 * the client mounts them explicitly through `ctx.remote.$mount`.
 */
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { OFFPEAK_INVOCATIONS, type LedgerEntry, type OffpeakSettings, type OffpeakSettingsUpdate, type OffpeakStatus, type QueueEntry } from '../contract.ts'

/** The mounted Remote contribution (package + strict wire descriptors). */
export const OFFPEAK_REMOTE: TypertRemoteContribution = {
  package: 'dsh-offpeak',
  descriptors: OFFPEAK_INVOCATIONS,
}

/** Remote call envelope as produced by the API gateway. */
export type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string; details: object } }

/** The mounted offpeak namespace service's callable face. */
export interface OffpeakRemoteFace {
  getStatus(): Promise<RemoteResult<OffpeakStatus>>
  getSettings(): Promise<RemoteResult<OffpeakSettings>>
  updateSettings(update: OffpeakSettingsUpdate): Promise<RemoteResult<OffpeakSettings>>
  getQueue(): Promise<RemoteResult<QueueEntry[]>>
  cancelQueue(id: string): Promise<RemoteResult<QueueEntry[]>>
  getLedger(limit: number): Promise<RemoteResult<LedgerEntry[]>>
  clearLedger(): Promise<RemoteResult<number>>
}

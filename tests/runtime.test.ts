/**
 * Runtime integration tests: OffpeakRuntime wired to a real cordis Context
 * with a temp-dir store and a scripted settings scope. Covers the service
 * surface the tools, commands, and the web client all go through.
 */
import { Context } from '@deepseek-ai/cordis'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import { OffpeakRuntime } from '../src/runtime.ts'
import { OffpeakStore } from '../src/store.ts'
import { defaultOffpeakSettings } from '../src/defaults.ts'
import type { OffpeakSettings } from '../src/contract.ts'

let dir: string
let ctx: Context
let store: OffpeakStore
let runtime: OffpeakRuntime
let current: OffpeakSettings

/** Scripted settings scope (get/update only — all the runtime uses). */
function fakeSettingsScope(): SettingsScope<OffpeakSettings> {
  return {
    get: () => current,
    update: async (patch: object) => { current = { ...current, ...patch } },
    watch: () => () => {},
    replace: async (section: object) => { current = { ...defaultOffpeakSettings(), ...section } },
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dsh-offpeak-runtime-'))
  ctx = new Context()
  store = new OffpeakStore(dir)
  current = defaultOffpeakSettings()
  runtime = new OffpeakRuntime(ctx, store, fakeSettingsScope())
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('OffpeakRuntime', () => {
  it('reports the current window with multiplier and prices', () => {
    // 10:00 UTC is peak with the default multiplier of 2.
    const status = runtime.buildStatus(new Date('2026-03-15T10:00:00.000Z'))
    expect(status.window).toBe('peak')
    expect(status.multiplier).toBe(2)
    expect(status.prices.inputPerM).toBeCloseTo(0.56, 10)
    expect(status.prices.cacheHitPerM).toBeCloseTo(0.056, 10)
    expect(status.prices.outputPerM).toBeCloseTo(0.84, 10)
    expect(status.currency).toBe('USD')
    expect(status.queue).toEqual({ total: 0, pending: 0, done: 0, cancelled: 0 })
  })

  it('computes off-peak prices outside peak hours', () => {
    const status = runtime.buildStatus(new Date('2026-03-15T20:00:00.000Z'))
    expect(status.window).toBe('offpeak')
    expect(status.multiplier).toBe(1)
    expect(status.prices.inputPerM).toBeCloseTo(0.28, 10)
  })

  it('estimates now-vs-offpeak and records the ledger row', () => {
    const comparison = runtime.estimate({ inputTokens: 1_000_000, outputTokens: 500_000 }, new Date('2026-03-15T10:00:00.000Z'))
    expect(comparison.savingsPercent).toBe(50)
    runtime.recordEstimate({ inputTokens: 1_000_000, outputTokens: 500_000 }, comparison, 'nightly embed')
    const ledger = store.readLedger()
    expect(ledger).toHaveLength(1)
    expect(ledger[0]?.kind).toBe('estimate')
    expect(ledger[0]?.summary).toBe('nightly embed')
    expect(ledger[0]?.savings).toBe(comparison.savingsUsd)
  })

  it('defers tasks and records defer-created rows', () => {
    const entry = runtime.defer({ summary: 'run migrations' }, new Date('2026-03-15T10:00:00.000Z'))
    expect(entry.windowAtCreation).toBe('peak')
    expect(runtime.buildStatus().queue.pending).toBe(1)
    expect(store.readLedger()[0]?.kind).toBe('defer-created')
  })

  it('completes a deferred task with recorded savings', () => {
    const entry = runtime.defer({ summary: 'batch export', inputTokens: 10_000 }, new Date('2026-03-15T10:00:00.000Z'))
    const done = runtime.complete(entry.id, { inputTokens: 10_000 })
    expect(done?.status).toBe('done')
    expect(done?.savings).toBeGreaterThan(0)
    const ledger = store.readLedger()
    expect(ledger[0]?.kind).toBe('defer-done')
  })

  it('cancels a deferred task and returns the updated queue', () => {
    const entry = runtime.defer({ summary: 'oops' })
    const queue = runtime.cancel(entry.id)
    expect(queue[0]?.status).toBe('cancelled')
    expect(store.readLedger()[0]?.kind).toBe('defer-cancelled')
  })

  it('applies settings updates through the scope', async () => {
    await runtime.updateSettings({ field: 'peakMultiplier', value: 3 })
    expect(current.peakMultiplier).toBe(3)
    const status = runtime.buildStatus(new Date('2026-03-15T10:00:00.000Z'))
    expect(status.multiplier).toBe(3)
  })

  it('reports savings today from the ledger with the display offset', () => {
    runtime.recordEstimate(
      { inputTokens: 1_000_000, outputTokens: 0, cacheHitTokens: 0 },
      { window: 'peak', multiplier: 2, costNowUsd: 0.56, costOffpeakUsd: 0.28, savingsUsd: 0.28, savingsPercent: 50, recommendation: 'defer' },
      'x',
    )
    const status = runtime.buildStatus() // real clock — matches the ledger timestamp
    expect(status.savingsToday).toBeCloseTo(0.28, 10)
    expect(status.ledger.savingsTotal).toBeCloseTo(0.28, 10)
  })

  it('records a window switch only once per change', () => {
    runtime.noteWindowSwitch(new Date('2026-03-15T08:00:00.000Z')) // offpeak
    runtime.noteWindowSwitch(new Date('2026-03-15T08:00:00.000Z')) // same — no row
    runtime.noteWindowSwitch(new Date('2026-03-15T10:00:00.000Z')) // peak — row
    runtime.noteWindowSwitch(new Date('2026-03-15T11:00:00.000Z')) // peak — no row
    const ledger = store.readLedger()
    expect(ledger).toHaveLength(1)
    expect(ledger[0]?.kind).toBe('status')
  })

  it('exposes the wire methods used by the client', async () => {
    const status = await runtime.getStatus()
    expect(status.queue.total).toBe(0)
    const settings = await runtime.getSettings()
    expect(settings.enabled).toBe(true)
    await runtime.updateSettings({ field: 'currency', value: 'CNY' })
    expect((await runtime.getSettings()).currency).toBe('CNY')
    const entry = runtime.defer({ summary: 'wire' })
    const queue = await runtime.getQueue()
    expect(queue).toHaveLength(1)
    const cancelled = await runtime.cancelQueue(entry.id)
    expect(cancelled[0]?.status).toBe('cancelled')
    await runtime.getLedger(10)
    expect(await runtime.clearLedger()).toBeGreaterThanOrEqual(2)
  })
})

/**
 * The dsh-offpeak host Remote service (`ctx.offpeak`, wire namespace
 * `offpeak`). Registered as a TypertRemoteService so the Host Gateway's
 * source-mode discovery exports its @Remote methods to the Web client under
 * `/api/offpeak/<method>` with zero generated artifacts. The service is the
 * single source of truth for status, settings, the defer queue, and the
 * savings ledger; tools, commands, and the browser all read through it.
 */
import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import type {
  LedgerEntry,
  OffpeakSettings,
  OffpeakSettingsUpdate,
  OffpeakStatus,
  QueueEntry,
} from './contract.ts'
import { applySettingsUpdate } from './defaults.ts'
import { compareNowVsOffpeak, costUsd, multiplierFor, nextSwitchAt, roundUsd, windowKindAt } from './pricing.ts'
import { OffpeakStore, type DeferInput } from './store.ts'

/** Options for one cost estimate. */
export interface EstimateInput {
  readonly inputTokens: number
  readonly outputTokens?: number
  readonly cacheHitTokens?: number
}

/**
 * Off-peak service: pricing status, durable settings, the defer queue, and
 * the savings ledger.
 */
export class OffpeakRuntime extends TypertRemoteService {
  /** The last window observed by this process, for switch reminders. */
  private lastWindow: 'peak' | 'offpeak' | undefined

  /**
   * Register the service under the `offpeak` key (the wire namespace).
   * @param ctx - owning cordis context.
   * @param store - the durable queue/ledger store.
   * @param settings - the live settings scope.
   */
  constructor(
    ctx: Context,
    readonly store: OffpeakStore,
    private readonly settings: SettingsScope<OffpeakSettings>,
  ) {
    super(ctx, 'offpeak')
  }

  /** Live settings (schema defaults + user layer). */
  settingsValue(): OffpeakSettings {
    return this.settings.get()
  }

  /** Current window kind at a given instant. */
  windowAt(now: Date): 'peak' | 'offpeak' {
    return windowKindAt(now)
  }

  /** Build the aggregate status snapshot. */
  buildStatus(now: Date = new Date()): OffpeakStatus {
    const config = this.settingsValue()
    const window = windowKindAt(now)
    const multiplier = multiplierFor(window, config.peakMultiplier)
    const next = nextSwitchAt(now)
    const queue = this.store.readQueue()
    const ledger = this.store.readLedger(500)
    return {
      now: now.toISOString(),
      window,
      multiplier,
      nextSwitchAt: next.at.toISOString(),
      nextWindow: next.to,
      prices: {
        inputPerM: roundUsd(config.inputPricePerM * multiplier),
        cacheHitPerM: roundUsd(config.cacheHitPricePerM * multiplier),
        outputPerM: roundUsd(config.outputPricePerM * multiplier),
      },
      currency: config.currency,
      savingsToday: roundUsd(this.store.savingsForDay(now, config.displayUtcOffsetMinutes)),
      queue: this.store.queueCounts(queue),
      ledger: {
        total: ledger.length,
        savingsTotal: roundUsd(this.store.savingsTotal(ledger)),
      },
    }
  }

  /**
   * Record a window-switch observation when the window changed since the last
   * call (used by tools and commands when `remindOnSwitch` is on).
   */
  noteWindowSwitch(now: Date = new Date()): void {
    if (!this.settingsValue().remindOnSwitch) return
    const window = windowKindAt(now)
    if (this.lastWindow === undefined) {
      this.lastWindow = window
      return
    }
    if (this.lastWindow !== window) {
      this.store.appendLedger({
        id: randomUUID(),
        ts: now.toISOString(),
        kind: 'status',
        summary: `window switched to ${window}`,
      })
      this.lastWindow = window
    }
  }

  /** One now-vs-off-peak comparison for the given tokens. */
  estimate(input: EstimateInput, now: Date = new Date()): ReturnType<typeof compareNowVsOffpeak> {
    const config = this.settingsValue()
    return compareNowVsOffpeak(
      {
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens ?? 0,
        cacheHitTokens: input.cacheHitTokens ?? 0,
      },
      {
        inputPerM: config.inputPricePerM,
        cacheHitPerM: config.cacheHitPricePerM,
        outputPerM: config.outputPricePerM,
      },
      config.peakMultiplier,
      now,
    )
  }

  /** Append one estimate row to the ledger. */
  recordEstimate(input: EstimateInput, comparison: ReturnType<typeof compareNowVsOffpeak>, summary?: string): void {
    this.store.appendLedger({
      id: randomUUID(),
      ts: new Date().toISOString(),
      kind: 'estimate',
      summary,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens ?? 0,
      cacheHitTokens: input.cacheHitTokens ?? 0,
      costNow: roundUsd(comparison.costNowUsd),
      costOffpeak: roundUsd(comparison.costOffpeakUsd),
      savings: roundUsd(comparison.savingsUsd),
    })
  }

  /** Enqueue one deferred task and record its ledger row. */
  defer(input: Omit<DeferInput, 'windowAtCreation'>, now: Date = new Date()): QueueEntry {
    const entry = this.store.enqueue({
      ...input,
      windowAtCreation: windowKindAt(now),
    })
    let savings: number | undefined
    if (input.inputTokens !== undefined) {
      const comparison = this.estimate({ inputTokens: input.inputTokens, outputTokens: input.outputTokens, cacheHitTokens: input.cacheHitTokens }, now)
      savings = roundUsd(comparison.savingsUsd)
    }
    this.store.appendLedger({
      id: randomUUID(),
      ts: new Date().toISOString(),
      kind: 'defer-created',
      summary: entry.summary,
      savings,
    })
    return entry
  }

  /** Mark one pending task done and record its savings row. */
  complete(id: string, tokens: EstimateInput | undefined): QueueEntry | undefined {
    let savings: number | undefined
    let costNow: number | undefined
    let costOffpeak: number | undefined
    if (tokens !== undefined) {
      const comparison = this.estimate(tokens)
      savings = roundUsd(comparison.savingsUsd)
      costNow = roundUsd(comparison.costNowUsd)
      costOffpeak = roundUsd(comparison.costOffpeakUsd)
    }
    const updated = this.store.complete(id, savings, costNow, costOffpeak)
    if (updated !== undefined) {
      this.store.appendLedger({
        id: randomUUID(),
        ts: new Date().toISOString(),
        kind: 'defer-done',
        summary: updated.summary,
        savings,
      })
    }
    return updated
  }

  /** Cancel one pending task and record its ledger row. */
  cancel(id: string): QueueEntry[] {
    const updated = this.store.cancel(id)
    if (updated !== undefined) {
      this.store.appendLedger({
        id: randomUUID(),
        ts: new Date().toISOString(),
        kind: 'defer-cancelled',
        summary: updated.summary,
      })
    }
    return this.store.readQueue()
  }

  /** Effective USD cost of a request at the current window. */
  costUsdNow(input: EstimateInput, now: Date = new Date()): number {
    const config = this.settingsValue()
    return costUsd(
      { inputTokens: input.inputTokens, outputTokens: input.outputTokens ?? 0, cacheHitTokens: input.cacheHitTokens ?? 0 },
      { inputPerM: config.inputPricePerM, cacheHitPerM: config.cacheHitPricePerM, outputPerM: config.outputPricePerM },
      multiplierFor(windowKindAt(now), config.peakMultiplier),
    )
  }

  /* ---------------- Remote surface (wire namespace `offpeak`) ---------------- */

  /** Aggregate status snapshot. */
  @Remote
  getStatus(): OffpeakStatus {
    return this.buildStatus()
  }

  /** Read the resolved durable settings. */
  @Remote
  getSettings(): OffpeakSettings {
    return this.settingsValue()
  }

  /** Persist one settings field and return the resolved section. */
  @Remote
  updateSettings(update: OffpeakSettingsUpdate): Promise<OffpeakSettings> {
    return this.settings.update(applySettingsUpdate(this.settingsValue(), update)).then(() => this.settingsValue())
  }

  /** The full defer queue, newest first. */
  @Remote
  getQueue(): QueueEntry[] {
    return [...this.store.readQueue()].reverse()
  }

  /** Cancel one pending task; returns the updated queue. */
  @Remote
  cancelQueue(id: string): QueueEntry[] {
    return this.cancel(id)
  }

  /** The ledger tail, newest first. */
  @Remote
  getLedger(limit: number): LedgerEntry[] {
    return this.store.readLedger(limit)
  }

  /** Remove every ledger row; returns the number removed. */
  @Remote
  clearLedger(): number {
    return this.store.clearLedger()
  }
}

/**
 * Pure off-peak pricing engine.
 *
 * DeepSeek prices API usage in two windows defined in UTC (see the official
 * pricing page): the peak window is 08:30–16:30 UTC and costs `peakMultiplier`
 * (official default 2) times the off-peak price. Everything in this module is
 * a pure function of its inputs — no I/O, no state — so the identical logic
 * runs in the host (tools, commands, ledger) and is bundled into the browser
 * (status pill), keeping every surface consistent by construction.
 */
import type { OffpeakWindowKind, WindowPrices } from './contract.ts'

/** Peak window start: 08:30 UTC, in minutes since UTC midnight. */
export const PEAK_START_MINUTES = 8 * 60 + 30
/** Peak window end: 16:30 UTC, in minutes since UTC midnight. */
export const PEAK_END_MINUTES = 16 * 60 + 30

const MINUTES_PER_DAY = 24 * 60

/** The official DeepSeek window boundaries, exposed for docs and tests. */
export const WINDOW_BOUNDARIES = {
  peakStartUtc: { hour: 8, minute: 30 },
  peakEndUtc: { hour: 16, minute: 30 },
} as const

/** Fractional minutes since UTC midnight for one instant. */
export function utcMinutesOf(date: Date): number {
  return date.getUTCHours() * 60
    + date.getUTCMinutes()
    + date.getUTCSeconds() / 60
    + date.getUTCMilliseconds() / 60_000
}

/** The pricing window containing one instant (peak starts exactly at 08:30:00.000 UTC). */
export function windowKindAt(date: Date): OffpeakWindowKind {
  const minutes = utcMinutesOf(date)
  return minutes >= PEAK_START_MINUTES && minutes < PEAK_END_MINUTES ? 'peak' : 'offpeak'
}

/** The effective price multiplier for one window. */
export function multiplierFor(window: OffpeakWindowKind, peakMultiplier: number): number {
  return window === 'peak' ? peakMultiplier : 1
}

/**
 * The next window switch strictly after `date`.
 * @returns the switch instant and the window that begins there.
 */
export function nextSwitchAt(date: Date): { at: Date; to: OffpeakWindowKind } {
  const minutes = utcMinutesOf(date)
  if (minutes < PEAK_START_MINUTES) {
    // Off-peak → peak later today.
    return { at: utcDateAtMinutes(date, PEAK_START_MINUTES), to: 'peak' }
  }
  if (minutes < PEAK_END_MINUTES) {
    // Peak → off-peak later today.
    return { at: utcDateAtMinutes(date, PEAK_END_MINUTES), to: 'offpeak' }
  }
  // Off-peak → peak tomorrow.
  const tomorrow = new Date(date)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return { at: utcDateAtMinutes(tomorrow, PEAK_START_MINUTES), to: 'peak' }
}

/** Build a Date at a given fractional minutes-since-UTC-midnight value, same day as `base`. */
function utcDateAtMinutes(base: Date, minutes: number): Date {
  const whole = Math.floor(minutes)
  const ms = Math.round((minutes - whole) * 1000)
  const date = new Date(base)
  date.setUTCHours(0, whole, 0, ms)
  return date
}

/** Token counts for one cost estimate. */
export interface TokenCounts {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheHitTokens: number
}

/** Cost of one request in USD at a given window multiplier. */
export function costUsd(
  tokens: TokenCounts,
  prices: WindowPrices,
  multiplier: number,
): number {
  const input = tokens.inputTokens * prices.inputPerM
  const cacheHit = tokens.cacheHitTokens * prices.cacheHitPerM
  const output = tokens.outputTokens * prices.outputPerM
  return ((input + cacheHit + output) / 1_000_000) * multiplier
}

/** One now-vs-off-peak comparison. */
export interface OffpeakComparison {
  readonly window: OffpeakWindowKind
  readonly multiplier: number
  /** Cost if the request runs right now, in USD. */
  readonly costNowUsd: number
  /** Cost if the request runs during off-peak, in USD. */
  readonly costOffpeakUsd: number
  /** Absolute saving in USD (never negative). */
  readonly savingsUsd: number
  /** Saving as a percentage of the now cost (0 when the now cost is 0). */
  readonly savingsPercent: number
  /** Plain-language recommendation for the model. */
  readonly recommendation: string
}

/**
 * Compare running one request now versus during off-peak.
 * @param tokens - token counts for the request.
 * @param prices - base (off-peak) price table.
 * @param peakMultiplier - the peak multiplier.
 * @param now - the reference instant.
 */
export function compareNowVsOffpeak(
  tokens: TokenCounts,
  prices: WindowPrices,
  peakMultiplier: number,
  now: Date,
): OffpeakComparison {
  const window = windowKindAt(now)
  const multiplier = multiplierFor(window, peakMultiplier)
  const costNow = costUsd(tokens, prices, multiplier)
  const costOffpeak = costUsd(tokens, prices, 1)
  const savings = Math.max(0, costNow - costOffpeak)
  const percent = costNow > 0 ? Math.round((savings / costNow) * 1000) / 10 : 0
  const recommendation = window === 'offpeak'
    ? 'Already off-peak: running now costs the minimum.'
    : savings > 0
      ? `Defer to off-peak to save ${percent}% (${Math.round(savings * 1e6) / 1e6} USD).`
      : 'No saving available by deferring.'
  return { window, multiplier, costNowUsd: costNow, costOffpeakUsd: costOffpeak, savingsUsd: savings, savingsPercent: percent, recommendation }
}

/** Milliseconds until the next window switch (always positive). */
export function msUntilNextSwitch(now: Date): number {
  return Math.max(1, nextSwitchAt(now).at.getTime() - now.getTime())
}

/** Format a duration for display: `3h 12m` or `12m 05s` (short form below one hour). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  return `${seconds}s`
}

/** Format a countdown with second precision for live clocks: `03:12:44`. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map(part => String(part).padStart(2, '0')).join(':')
}

/**
 * Format a wall-clock time in the configured display offset.
 * @param date - the instant (UTC-based engine).
 * @param utcOffsetMinutes - display offset, e.g. 480 for UTC+8.
 */
export function formatWallClock(date: Date, utcOffsetMinutes: number): string {
  const shifted = new Date(date.getTime() + utcOffsetMinutes * 60_000)
  const hours = shifted.getUTCHours()
  const minutes = shifted.getUTCMinutes()
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** Round a USD amount for display (6 significant decimals is plenty for API costs). */
export function roundUsd(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

/** Sum of `savings` over ledger rows (client-side aggregate over wire data). */
export function sumSavings(ledger: readonly { readonly savings?: number }[]): number {
  return roundUsd(ledger.reduce((sum, entry) => sum + (entry.savings ?? 0), 0))
}

/**
 * Sum of savings recorded during one display day (the display offset defines
 * the day boundary, matching what the UI shows). Pure and client-safe.
 */
export function savingsForDay(
  ledger: readonly { readonly ts: string; readonly savings?: number }[],
  day: Date,
  utcOffsetMinutes: number,
): number {
  const shifted = day.getTime() + utcOffsetMinutes * 60_000
  const dayStart = shifted - (shifted % 86_400_000) - utcOffsetMinutes * 60_000
  const dayEnd = dayStart + 86_400_000
  return roundUsd(ledger.reduce((sum, entry) => {
    const ts = Date.parse(entry.ts)
    if (Number.isNaN(ts) || ts < dayStart || ts >= dayEnd) return sum
    return sum + (entry.savings ?? 0)
  }, 0))
}

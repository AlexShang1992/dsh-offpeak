/**
 * Pure off-peak pricing engine.
 *
 * DeepSeek prices API usage in two windows defined in UTC (see the official
 * pricing page): the peak window is 08:30–16:30 UTC and costs `peakMultiplier`
 * (official default 2) times the off-peak price. Everything in this module is
 * a pure function of its inputs — no I/O, no state — so the same module the
 * host validates is the one bundled into the browser, where the status pill
 * derives the window, the countdown, and the effective prices locally.
 */
import type { OffpeakWindowKind } from './contract.ts'

/** Peak window start: 08:30 UTC, in minutes since UTC midnight. */
export const PEAK_START_MINUTES = 8 * 60 + 30
/** Peak window end: 16:30 UTC, in minutes since UTC midnight. */
export const PEAK_END_MINUTES = 16 * 60 + 30

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

/** Milliseconds until the next window switch (always positive). */
export function msUntilNextSwitch(now: Date): number {
  return Math.max(1, nextSwitchAt(now).at.getTime() - now.getTime())
}

/** Format a duration for display at minute precision, compact style: `4h27m`, `47m`, or `<1m`. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000)
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours}h${String(minutes).padStart(2, '0')}m`
  }
  if (totalMinutes > 0) return `${totalMinutes}m`
  return '<1m'
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

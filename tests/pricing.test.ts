/**
 * Pricing engine tests: window boundaries, switch times, cost math,
 * now-vs-off-peak comparisons, and display helpers.
 */
import { describe, expect, it } from 'vitest'
import {
  PEAK_END_MINUTES,
  PEAK_START_MINUTES,
  compareNowVsOffpeak,
  costUsd,
  formatCountdown,
  formatDuration,
  formatWallClock,
  msUntilNextSwitch,
  multiplierFor,
  nextSwitchAt,
  roundUsd,
  savingsForDay,
  sumSavings,
  utcMinutesOf,
  windowKindAt,
} from '../src/pricing.ts'

/** Build a Date at a given UTC wall time. */
function utc(hour: number, minute = 0, second = 0, ms = 0): Date {
  const date = new Date(Date.UTC(2026, 2, 15, hour, minute, second, ms))
  return date
}

const PRICES = { inputPerM: 0.28, cacheHitPerM: 0.028, outputPerM: 0.42 }

describe('windowKindAt', () => {
  it('classifies off-peak before 08:30 UTC', () => {
    expect(windowKindAt(utc(8, 29, 59, 999))).toBe('offpeak')
  })

  it('starts peak exactly at 08:30:00.000 UTC', () => {
    expect(windowKindAt(utc(8, 30))).toBe('peak')
  })

  it('classifies the middle of peak as peak', () => {
    expect(windowKindAt(utc(12, 0))).toBe('peak')
  })

  it('keeps peak until 16:29:59.999 UTC', () => {
    expect(windowKindAt(utc(16, 29, 59, 999))).toBe('peak')
  })

  it('starts off-peak exactly at 16:30:00.000 UTC', () => {
    expect(windowKindAt(utc(16, 30))).toBe('offpeak')
  })

  it('classifies midnight as off-peak', () => {
    expect(windowKindAt(utc(0, 0))).toBe('offpeak')
  })

  it('classifies 23:59 UTC as off-peak', () => {
    expect(windowKindAt(utc(23, 59, 59, 999))).toBe('offpeak')
  })

  it('handles the day boundary', () => {
    expect(windowKindAt(new Date('2026-03-15T00:00:00.000Z'))).toBe('offpeak')
  })
})

describe('utcMinutesOf', () => {
  it('matches the window constants', () => {
    expect(utcMinutesOf(utc(8, 30))).toBe(PEAK_START_MINUTES)
    expect(utcMinutesOf(utc(16, 30))).toBe(PEAK_END_MINUTES)
  })
})

describe('multiplierFor', () => {
  it('applies the configured multiplier only in peak', () => {
    expect(multiplierFor('peak', 2)).toBe(2)
    expect(multiplierFor('offpeak', 2)).toBe(1)
    expect(multiplierFor('peak', 3)).toBe(3)
  })
})

describe('nextSwitchAt', () => {
  it('off-peak before 08:30 switches to peak at 08:30 same day', () => {
    const next = nextSwitchAt(utc(1, 0))
    expect(next.to).toBe('peak')
    expect(next.at.toISOString()).toBe('2026-03-15T08:30:00.000Z')
  })

  it('peak switches to off-peak at 16:30 same day', () => {
    const next = nextSwitchAt(utc(10, 0))
    expect(next.to).toBe('offpeak')
    expect(next.at.toISOString()).toBe('2026-03-15T16:30:00.000Z')
  })

  it('off-peak after 16:30 switches to peak the next day', () => {
    const next = nextSwitchAt(utc(20, 0))
    expect(next.to).toBe('peak')
    expect(next.at.toISOString()).toBe('2026-03-16T08:30:00.000Z')
  })

  it('is strictly in the future at the exact boundary', () => {
    const next = nextSwitchAt(utc(8, 30))
    expect(next.at.getTime()).toBeGreaterThan(utc(8, 30).getTime())
    expect(next.to).toBe('offpeak')
  })
})

describe('costUsd', () => {
  it('computes a simple request', () => {
    const cost = costUsd({ inputTokens: 1_000_000, outputTokens: 1_000_000, cacheHitTokens: 1_000_000 }, PRICES, 1)
    expect(roundUsd(cost)).toBe(0.728)
  })

  it('applies the multiplier', () => {
    const base = costUsd({ inputTokens: 1_000_000, outputTokens: 0, cacheHitTokens: 0 }, PRICES, 1)
    const peak = costUsd({ inputTokens: 1_000_000, outputTokens: 0, cacheHitTokens: 0 }, PRICES, 2)
    expect(peak).toBeCloseTo(base * 2, 10)
  })

  it('is zero for an empty request', () => {
    expect(costUsd({ inputTokens: 0, outputTokens: 0, cacheHitTokens: 0 }, PRICES, 2)).toBe(0)
  })
})

describe('compareNowVsOffpeak', () => {
  it('reports no saving during off-peak', () => {
    const comparison = compareNowVsOffpeak(
      { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheHitTokens: 0 },
      PRICES,
      2,
      utc(20, 0),
    )
    expect(comparison.window).toBe('offpeak')
    expect(comparison.multiplier).toBe(1)
    expect(comparison.savingsUsd).toBe(0)
    expect(comparison.savingsPercent).toBe(0)
    expect(comparison.costNowUsd).toBe(comparison.costOffpeakUsd)
  })

  it('quantifies the deferral saving during peak', () => {
    const comparison = compareNowVsOffpeak(
      { inputTokens: 1_000_000, outputTokens: 500_000, cacheHitTokens: 2_000_000 },
      PRICES,
      2,
      utc(10, 0),
    )
    expect(comparison.window).toBe('peak')
    expect(comparison.multiplier).toBe(2)
    expect(comparison.costNowUsd).toBeCloseTo(comparison.costOffpeakUsd * 2, 10)
    expect(comparison.savingsUsd).toBeCloseTo(comparison.costOffpeakUsd, 10)
    expect(comparison.savingsPercent).toBe(50)
  })

  it('never reports negative savings', () => {
    const comparison = compareNowVsOffpeak(
      { inputTokens: 1_000_000, outputTokens: 0, cacheHitTokens: 0 },
      PRICES,
      0.5,
      utc(10, 0),
    )
    expect(comparison.savingsUsd).toBeGreaterThanOrEqual(0)
  })

  it('handles a zero-cost request', () => {
    const comparison = compareNowVsOffpeak(
      { inputTokens: 0, outputTokens: 0, cacheHitTokens: 0 },
      PRICES,
      2,
      utc(10, 0),
    )
    expect(comparison.savingsPercent).toBe(0)
    expect(comparison.costNowUsd).toBe(0)
  })
})

describe('duration formatting', () => {
  it('formats hours', () => {
    expect(formatDuration(3 * 3600_000 + 12 * 60_000)).toBe('3h 12m')
  })

  it('formats minutes with seconds', () => {
    expect(formatDuration(12 * 60_000 + 5_000)).toBe('12m 05s')
  })

  it('formats seconds', () => {
    expect(formatDuration(7_000)).toBe('7s')
  })

  it('countdown pads to HH:MM:SS', () => {
    expect(formatCountdown(3 * 3600_000 + 12 * 60_000 + 44_000)).toBe('03:12:44')
    expect(formatCountdown(0)).toBe('00:00:00')
  })

  it('msUntilNextSwitch is positive', () => {
    expect(msUntilNextSwitch(utc(10, 0))).toBe(6.5 * 3600_000)
  })
})

describe('wall-clock formatting', () => {
  it('shifts by the display offset', () => {
    expect(formatWallClock(utc(8, 30), 480)).toBe('16:30')
    expect(formatWallClock(utc(16, 30), 480)).toBe('00:30')
    expect(formatWallClock(utc(1, 5), 0)).toBe('01:05')
  })
})

describe('ledger aggregation', () => {
  const ledger = [
    { ts: '2026-03-15T10:00:00.000Z', savings: 1 },
    { ts: '2026-03-15T12:00:00.000Z', savings: 0.5 },
    { ts: '2026-03-14T10:00:00.000Z', savings: 2 },
    { ts: '2026-03-14T18:00:00.000Z', savings: 0.75 },
    { ts: '2026-03-16T00:00:00.000Z', savings: 3 },
  ]

  it('sums all savings', () => {
    expect(sumSavings(ledger)).toBe(7.25)
  })

  it('aggregates per display day with the offset boundary', () => {
    // UTC+8: the display day starts at 16:00Z the previous day, so Mar 14
    // 18:00Z (Mar 15 02:00 local) belongs to the Mar 15 display day.
    const day15 = new Date('2026-03-15T00:00:00.000Z')
    expect(savingsForDay(ledger, day15, 480)).toBeCloseTo(2.25, 10)
    expect(savingsForDay(ledger, day15, 0)).toBeCloseTo(1.5, 10)
  })

  it('handles an empty ledger', () => {
    expect(sumSavings([])).toBe(0)
    expect(savingsForDay([], new Date(), 480)).toBe(0)
  })
})

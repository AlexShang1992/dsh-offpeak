/**
 * Pricing engine tests: window boundaries, switch times, and the display
 * helpers the status pill renders.
 */
import { describe, expect, it } from 'vitest'
import {
  PEAK_END_MINUTES,
  PEAK_START_MINUTES,
  formatDuration,
  formatWallClock,
  msUntilNextSwitch,
  multiplierFor,
  nextSwitchAt,
  utcMinutesOf,
  windowKindAt,
} from '../src/pricing.ts'

/** Build a Date at a given UTC wall time. */
function utc(hour: number, minute = 0, second = 0, ms = 0): Date {
  const date = new Date(Date.UTC(2026, 2, 15, hour, minute, second, ms))
  return date
}

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

describe('duration formatting', () => {
  it('formats hours and minutes compactly', () => {
    expect(formatDuration(4 * 3600_000 + 27 * 60_000)).toBe('4h27m')
    expect(formatDuration(3 * 3600_000 + 5 * 60_000)).toBe('3h05m')
  })

  it('formats minutes alone', () => {
    expect(formatDuration(47 * 60_000 + 30_000)).toBe('47m')
  })

  it('formats less than a minute', () => {
    expect(formatDuration(7_000)).toBe('<1m')
    expect(formatDuration(0)).toBe('<1m')
  })

  it('never returns a negative duration', () => {
    expect(formatDuration(-5_000)).toBe('<1m')
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

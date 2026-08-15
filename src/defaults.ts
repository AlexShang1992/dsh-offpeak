/**
 * Defaults and normalization for dsh-offpeak.
 *
 * Default prices follow the DeepSeek official pricing page at the time of
 * writing (USD per 1M tokens, off-peak base). DeepSeek has announced future
 * price changes — treat these as editable starting points, never as a
 * guarantee: every figure is user-overridable in Settings, and the README
 * documents how to keep them current.
 */
import type { OffpeakSettings } from './contract.ts'

/** Official DeepSeek base prices (USD per 1M tokens, off-peak). */
export const DEFAULT_PRICES = {
  inputPerM: 0.28,
  cacheHitPerM: 0.028,
  outputPerM: 0.42,
} as const

/** Official DeepSeek peak multiplier (peak = 2 × off-peak). */
export const DEFAULT_PEAK_MULTIPLIER = 2

/** Display offset for Asia/Shanghai (UTC+8), the DeepSeek home market. */
export const DEFAULT_DISPLAY_UTC_OFFSET_MINUTES = 8 * 60

/** Common USD → CNY reference used only when the user picks CNY display. */
export const DEFAULT_CNY_PER_USD = 7.1

/** Fresh settings defaults for Host and browser initialization. */
export function defaultOffpeakSettings(): OffpeakSettings {
  return {
    enabled: true,
    currency: 'USD',
    cnyPerUsd: DEFAULT_CNY_PER_USD,
    inputPricePerM: DEFAULT_PRICES.inputPerM,
    cacheHitPricePerM: DEFAULT_PRICES.cacheHitPerM,
    outputPricePerM: DEFAULT_PRICES.outputPerM,
    peakMultiplier: DEFAULT_PEAK_MULTIPLIER,
    displayUtcOffsetMinutes: DEFAULT_DISPLAY_UTC_OFFSET_MINUTES,
    remindOnSwitch: true,
  }
}

/** Apply one field update to a settings object, returning a fresh object. */
export function applySettingsUpdate(
  current: OffpeakSettings,
  update: { field: string; value: unknown },
): OffpeakSettings {
  const patch: Record<string, unknown> = { [update.field]: update.value }
  return { ...current, ...patch }
}

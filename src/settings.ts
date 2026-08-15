/**
 * The `offpeak` settings namespace: every pricing and display preference is a
 * durable, user-editable section managed from the Web settings page. The
 * runtime reads the owner scope's live value on every call, so changes take
 * effect without a restart (`applies: 'live'`).
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace, type SettingsScope } from '@deepseek-ai/dsh-settings'
import type { OffpeakSettings } from './contract.ts'
import { DEFAULT_CNY_PER_USD, DEFAULT_DISPLAY_UTC_OFFSET_MINUTES, DEFAULT_PEAK_MULTIPLIER, DEFAULT_PRICES } from './defaults.ts'

/** The branded namespace name (the Web allowlist must list the same string). */
export const OFFPEAK_NAMESPACE = settingsNamespace('offpeak')

/** Schemastery schema of the `offpeak` namespace section. */
export const OffpeakSettingsSchema: z<OffpeakSettings> = z.object({
  enabled: z.boolean().default(true),
  currency: z.union(['USD', 'CNY'] as const).default('USD'),
  cnyPerUsd: z.number().min(0).default(DEFAULT_CNY_PER_USD),
  inputPricePerM: z.number().min(0).default(DEFAULT_PRICES.inputPerM),
  cacheHitPricePerM: z.number().min(0).default(DEFAULT_PRICES.cacheHitPerM),
  outputPricePerM: z.number().min(0).default(DEFAULT_PRICES.outputPerM),
  peakMultiplier: z.number().min(1).max(100).default(DEFAULT_PEAK_MULTIPLIER),
  displayUtcOffsetMinutes: z.number().min(-840).max(840).default(DEFAULT_DISPLAY_UTC_OFFSET_MINUTES),
})

/**
 * Register the namespace with the settings provider and return its owner scope.
 * @param ctx - the plugin context carrying the settings provider.
 * @returns the owner scope backing the runtime's live reads.
 */
export function registerOffpeakSettings(ctx: Context): SettingsScope<OffpeakSettings> {
  return ctx.settings.register(OFFPEAK_NAMESPACE, OffpeakSettingsSchema, { applies: 'live' })
}

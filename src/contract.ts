/**
 * The dsh-offpeak wire contract, shared verbatim by the host manifest
 * (`ctx.typert.register` in typert.ts), the host runtime (`OffpeakRuntime`),
 * and the client contribution (`ctx.remote.$mount` in client/remote.ts).
 * Every value crossing the wire is JSON-compatible and strictly codec-validated.
 */
import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

/** Display currency for price figures. */
export type Currency = 'USD' | 'CNY'

/** DeepSeek pricing window kind. */
export type OffpeakWindowKind = 'peak' | 'offpeak'

/** Per-window price table (USD per 1M tokens, before the peak multiplier). */
export interface WindowPrices {
  readonly inputPerM: number
  readonly cacheHitPerM: number
  readonly outputPerM: number
}

/** Durable plugin settings (the `offpeak` settings namespace). */
export interface OffpeakSettings {
  /** Whether the status pill is rendered under the composer. */
  readonly enabled: boolean
  /** Display currency for all price figures. */
  readonly currency: Currency
  /** USD → CNY conversion factor, used when `currency` is `CNY`. */
  readonly cnyPerUsd: number
  /** Input (cache-miss) price in USD per 1M tokens. */
  readonly inputPricePerM: number
  /** Cache-hit price in USD per 1M tokens. */
  readonly cacheHitPricePerM: number
  /** Output price in USD per 1M tokens. */
  readonly outputPricePerM: number
  /** Price multiplier applied during peak hours (DeepSeek official: 2). */
  readonly peakMultiplier: number
  /** UTC offset in minutes used only for local display of switch times. */
  readonly displayUtcOffsetMinutes: number
}

/** One field update sent through the plugin-owned settings Remote. */
export type OffpeakSettingsUpdate =
  | { readonly field: 'enabled'; readonly value: boolean }
  | { readonly field: 'currency'; readonly value: Currency }
  | { readonly field: 'cnyPerUsd'; readonly value: number }
  | { readonly field: 'inputPricePerM'; readonly value: number }
  | { readonly field: 'cacheHitPricePerM'; readonly value: number }
  | { readonly field: 'outputPricePerM'; readonly value: number }
  | { readonly field: 'peakMultiplier'; readonly value: number }
  | { readonly field: 'displayUtcOffsetMinutes'; readonly value: number }

/* ------------------------------------------------------------------ */
/* Wire codecs (zod). Host and client share these exact schemas.       */
/* ------------------------------------------------------------------ */

export const currencySchema = z.enum(['USD', 'CNY'])

export const offpeakWindowKindSchema = z.enum(['peak', 'offpeak'])

export const offpeakSettingsSchema = z.object({
  enabled: z.boolean(),
  currency: currencySchema,
  cnyPerUsd: z.number().min(0),
  inputPricePerM: z.number().min(0),
  cacheHitPricePerM: z.number().min(0),
  outputPricePerM: z.number().min(0),
  peakMultiplier: z.number().min(1).max(100),
  displayUtcOffsetMinutes: z.number().min(-840).max(840),
}).readonly()

export const offpeakSettingsUpdateSchema = z.discriminatedUnion('field', [
  z.object({ field: z.literal('enabled'), value: z.boolean() }).readonly(),
  z.object({ field: z.literal('currency'), value: currencySchema }).readonly(),
  z.object({ field: z.literal('cnyPerUsd'), value: z.number().min(0) }).readonly(),
  z.object({ field: z.literal('inputPricePerM'), value: z.number().min(0) }).readonly(),
  z.object({ field: z.literal('cacheHitPricePerM'), value: z.number().min(0) }).readonly(),
  z.object({ field: z.literal('outputPricePerM'), value: z.number().min(0) }).readonly(),
  z.object({ field: z.literal('peakMultiplier'), value: z.number().min(1).max(100) }).readonly(),
  z.object({ field: z.literal('displayUtcOffsetMinutes'), value: z.number().min(-840).max(840) }).readonly(),
])

/* ------------------------------------------------------------------ */
/* Typert invocation descriptors (strict wire contract).               */
/* ------------------------------------------------------------------ */

/** The dsh-offpeak Remote namespace's strict invocation descriptors. */
export const OFFPEAK_INVOCATIONS: readonly InvocationDescriptor[] = [
  {
    id: 'dsh-offpeak#offpeak/getSettings',
    service: 'offpeak',
    namespace: 'offpeak',
    method: 'getSettings',
    invocation: { kind: 'direct' },
    parameters: [],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-offpeak#OffpeakSettings',
      schema: offpeakSettingsSchema,
    },
  },
  {
    id: 'dsh-offpeak#offpeak/updateSettings',
    service: 'offpeak',
    namespace: 'offpeak',
    method: 'updateSettings',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'update',
        wire: 'update',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'dsh-offpeak#OffpeakSettingsUpdate',
          schema: offpeakSettingsUpdateSchema,
        },
      },
    ],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-offpeak#OffpeakSettings',
      schema: offpeakSettingsSchema,
    },
  },
]

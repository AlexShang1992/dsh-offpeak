/**
 * The dsh-offpeak wire contract, shared verbatim by the host manifest
 * (`ctx.typert.register` in typert.ts), the host runtime (`OffpeakRuntime`),
 * and the client contribution (`ctx.remote.$mount` in client/remote.ts).
 * Every value crossing the wire is JSON-compatible and strictly codec-validated.
 */
import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

/** Display currency for cost figures. */
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
  /** Whether the off-peak surface is enabled; false hides pill, tools stay available. */
  readonly enabled: boolean
  /** Display currency for all cost figures. */
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
  /** Whether the host reminds (via tools and status) when the window switches. */
  readonly remindOnSwitch: boolean
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
  | { readonly field: 'remindOnSwitch'; readonly value: boolean }

/** One deferred task in the durable queue. */
export interface QueueEntry {
  readonly id: string
  readonly summary: string
  readonly createdAt: string
  readonly status: 'pending' | 'done' | 'cancelled'
  /** The window the task was deferred during. */
  readonly windowAtCreation: OffpeakWindowKind
  /** Optional token estimates recorded at defer time. */
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly cacheHitTokens?: number
  /** Cost figures recorded when the task completed (est. now vs off-peak). */
  readonly costNow?: number
  readonly costOffpeak?: number
  readonly savings?: number
  readonly completedAt?: string
}

/** One append-only ledger row. */
export interface LedgerEntry {
  readonly id: string
  readonly ts: string
  readonly kind: 'estimate' | 'defer-created' | 'defer-done' | 'defer-cancelled' | 'status'
  readonly summary?: string
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly cacheHitTokens?: number
  readonly costNow?: number
  readonly costOffpeak?: number
  readonly savings?: number
}

/** Aggregate view served to tools, commands, and the web client. */
export interface OffpeakStatus {
  /** ISO timestamp of the snapshot. */
  readonly now: string
  /** Current window. */
  readonly window: OffpeakWindowKind
  /** Effective price multiplier for the current window. */
  readonly multiplier: number
  /** ISO timestamp of the next window switch. */
  readonly nextSwitchAt: string
  /** The window that starts at `nextSwitchAt`. */
  readonly nextWindow: OffpeakWindowKind
  /** Resolved price table (post-multiplier, per current window). */
  readonly prices: WindowPrices
  readonly currency: Currency
  /** Sum of savings recorded in the ledger for the current display day. */
  readonly savingsToday: number
  readonly queue: {
    readonly total: number
    readonly pending: number
    readonly done: number
    readonly cancelled: number
  }
  readonly ledger: {
    readonly total: number
    readonly savingsTotal: number
  }
}

/* ------------------------------------------------------------------ */
/* Wire codecs (zod). Host and client share these exact schemas.       */
/* ------------------------------------------------------------------ */

export const currencySchema = z.enum(['USD', 'CNY'])

export const offpeakWindowKindSchema = z.enum(['peak', 'offpeak'])

export const windowPricesSchema = z.object({
  inputPerM: z.number().min(0),
  cacheHitPerM: z.number().min(0),
  outputPerM: z.number().min(0),
}).readonly()

export const offpeakSettingsSchema = z.object({
  enabled: z.boolean(),
  currency: currencySchema,
  cnyPerUsd: z.number().min(0),
  inputPricePerM: z.number().min(0),
  cacheHitPricePerM: z.number().min(0),
  outputPricePerM: z.number().min(0),
  peakMultiplier: z.number().min(1).max(100),
  displayUtcOffsetMinutes: z.number().min(-840).max(840),
  remindOnSwitch: z.boolean(),
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
  z.object({ field: z.literal('remindOnSwitch'), value: z.boolean() }).readonly(),
])

export const queueEntrySchema = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  createdAt: z.string().min(1),
  status: z.enum(['pending', 'done', 'cancelled']),
  windowAtCreation: offpeakWindowKindSchema,
  inputTokens: z.number().min(0).optional(),
  outputTokens: z.number().min(0).optional(),
  cacheHitTokens: z.number().min(0).optional(),
  costNow: z.number().min(0).optional(),
  costOffpeak: z.number().min(0).optional(),
  savings: z.number().optional(),
  completedAt: z.string().min(1).optional(),
}).readonly()

export const ledgerEntrySchema = z.object({
  id: z.string().min(1),
  ts: z.string().min(1),
  kind: z.enum(['estimate', 'defer-created', 'defer-done', 'defer-cancelled', 'status']),
  summary: z.string().optional(),
  inputTokens: z.number().min(0).optional(),
  outputTokens: z.number().min(0).optional(),
  cacheHitTokens: z.number().min(0).optional(),
  costNow: z.number().min(0).optional(),
  costOffpeak: z.number().min(0).optional(),
  savings: z.number().optional(),
}).readonly()

export const offpeakStatusSchema = z.object({
  now: z.string(),
  window: offpeakWindowKindSchema,
  multiplier: z.number(),
  nextSwitchAt: z.string(),
  nextWindow: offpeakWindowKindSchema,
  prices: windowPricesSchema,
  currency: currencySchema,
  savingsToday: z.number(),
  queue: z.object({
    total: z.number(),
    pending: z.number(),
    done: z.number(),
    cancelled: z.number(),
  }),
  ledger: z.object({
    total: z.number(),
    savingsTotal: z.number(),
  }),
}).readonly()

export const queueEntryListSchema = z.array(queueEntrySchema).readonly()

export const ledgerEntryListSchema = z.array(ledgerEntrySchema).readonly()

/* ------------------------------------------------------------------ */
/* Typert invocation descriptors (strict wire contract).               */
/* ------------------------------------------------------------------ */

/** The dsh-offpeak Remote namespace's strict invocation descriptors. */
export const OFFPEAK_INVOCATIONS: readonly InvocationDescriptor[] = [
  {
    id: 'dsh-offpeak#offpeak/getStatus',
    service: 'offpeak',
    namespace: 'offpeak',
    method: 'getStatus',
    invocation: { kind: 'direct' },
    parameters: [],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-offpeak#OffpeakStatus',
      schema: offpeakStatusSchema,
    },
  },
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
  {
    id: 'dsh-offpeak#offpeak/getQueue',
    service: 'offpeak',
    namespace: 'offpeak',
    method: 'getQueue',
    invocation: { kind: 'direct' },
    parameters: [],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-offpeak#QueueEntry[]',
      schema: queueEntryListSchema,
    },
  },
  {
    id: 'dsh-offpeak#offpeak/cancelQueue',
    service: 'offpeak',
    namespace: 'offpeak',
    method: 'cancelQueue',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'id',
        wire: 'id',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'dsh-offpeak#id',
          schema: z.string().min(1),
        },
      },
    ],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-offpeak#QueueEntry[]',
      schema: queueEntryListSchema,
    },
  },
  {
    id: 'dsh-offpeak#offpeak/getLedger',
    service: 'offpeak',
    namespace: 'offpeak',
    method: 'getLedger',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'limit',
        wire: 'limit',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'dsh-offpeak#limit',
          schema: z.number().int().min(1).max(500),
        },
      },
    ],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-offpeak#LedgerEntry[]',
      schema: ledgerEntryListSchema,
    },
  },
  {
    id: 'dsh-offpeak#offpeak/clearLedger',
    service: 'offpeak',
    namespace: 'offpeak',
    method: 'clearLedger',
    invocation: { kind: 'direct' },
    parameters: [],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-offpeak#count',
      schema: z.number().int().min(0),
    },
  },
]

/**
 * Model-facing tools for dsh-offpeak. These let the agent itself reason about
 * DeepSeek pricing windows, estimate deferral savings, and manage the defer
 * queue — the "off-peak autopilot" primitive set. Every tool declares an exact
 * canonical output schema (validated against the returned value), so the
 * model always receives a well-defined shape.
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type ParameterSchemaSpec } from '@deepseek-ai/dsh-tools'
import type { OffpeakRuntime } from './runtime.ts'
import { formatDuration, msUntilNextSwitch, nextSwitchAt, roundUsd } from './pricing.ts'

/** The shared window enum used across schemas. */
const WINDOW = { type: 'string', enum: ['peak', 'offpeak'] } as const
const CURRENCY = { type: 'string', enum: ['USD', 'CNY'] } as const

/** Exact output schema of `offpeak_status`. */
const STATUS_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    window: WINDOW,
    multiplier: { type: 'number' },
    effectivePricesPerM: {
      type: 'object',
      additionalProperties: false,
      properties: {
        inputPerM: { type: 'number' },
        cacheHitPerM: { type: 'number' },
        outputPerM: { type: 'number' },
      },
    },
    currency: CURRENCY,
    nextSwitch: {
      type: 'object',
      additionalProperties: false,
      properties: {
        at: { type: 'string' },
        to: WINDOW,
        in: { type: 'string' },
      },
    },
    savingsToday: { type: 'number' },
    queue: {
      type: 'object',
      additionalProperties: false,
      properties: {
        total: { type: 'number' },
        pending: { type: 'number' },
        done: { type: 'number' },
        cancelled: { type: 'number' },
      },
    },
    ledger: {
      type: 'object',
      additionalProperties: false,
      properties: {
        total: { type: 'number' },
        savingsTotal: { type: 'number' },
      },
    },
  },
} as const

/** Exact output schema of `offpeak_estimate`. */
const ESTIMATE_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    window: WINDOW,
    multiplier: { type: 'number' },
    costNowUsd: { type: 'number' },
    costOffpeakUsd: { type: 'number' },
    savingsUsd: { type: 'number' },
    savingsPercent: { type: 'number' },
    recommendation: { type: 'string' },
  },
} as const

/** Exact output schema of `offpeak_defer`. */
const DEFER_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    entry: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string' },
        summary: { type: 'string' },
        createdAt: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'done', 'cancelled'] },
        windowAtCreation: WINDOW,
        inputTokens: { type: 'number' },
        outputTokens: { type: 'number' },
        cacheHitTokens: { type: 'number' },
        savings: { type: 'number' },
      },
    },
    nextOffpeakStart: {
      type: 'object',
      additionalProperties: false,
      properties: {
        at: { type: 'string' },
        in: { type: 'string' },
      },
    },
    note: { type: 'string' },
  },
} as const

/** Exact output schema of `offpeak_queue` (uniform shape for every action). */
const QUEUE_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: { type: 'string' },
    queue: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          summary: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'done', 'cancelled'] },
          deferredDuring: WINDOW,
          savingsUsd: { type: 'number' },
          createdAt: { type: 'string' },
        },
      },
    },
    error: { type: 'string' },
    removed: { type: 'number' },
  },
} as const

/** Register every dsh-offpeak model tool on `ctx.tools`. Returns the disposers. */
export function registerTools(ctx: Context, runtime: OffpeakRuntime): (() => void)[] {
  const disposers: (() => void)[] = []
  disposers.push(ctx.tools.register(defineTool({
    name: 'offpeak_status',
    description: 'Report the current DeepSeek pricing window (peak vs off-peak), the price multiplier, the countdown to the next switch, effective prices, savings recorded today, and defer-queue counts. Call this before deciding whether to defer expensive work.',
    parameters: {},
    output: {
      schema: STATUS_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    isConcurrencySafe: () => true,
    execute: async () => {
      const now = new Date()
      runtime.noteWindowSwitch(now)
      const status = runtime.buildStatus(now)
      const next = nextSwitchAt(now)
      return {
        window: status.window,
        multiplier: status.multiplier,
        effectivePricesPerM: status.prices,
        currency: status.currency,
        nextSwitch: {
          at: next.at.toISOString(),
          to: next.to,
          in: formatDuration(msUntilNextSwitch(now)),
        },
        savingsToday: status.savingsToday,
        queue: status.queue,
        ledger: status.ledger,
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'offpeak_estimate',
    description: 'Estimate the USD cost of one request now vs during off-peak, given token counts. Records the estimate in the savings ledger. Use before running a large or expensive job.',
    parameters: {
      inputTokens: { type: 'number', required: true, description: 'Input tokens (cache miss)' },
      outputTokens: { type: 'number', description: 'Output tokens (default 0)' },
      cacheHitTokens: { type: 'number', description: 'Cache-hit input tokens (default 0)' },
      summary: { type: 'string', description: 'Optional short label recorded in the ledger' },
    },
    output: {
      schema: ESTIMATE_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    isConcurrencySafe: () => true,
    execute: async (args) => {
      const now = new Date()
      const comparison = runtime.estimate({
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
        cacheHitTokens: args.cacheHitTokens,
      }, now)
      runtime.recordEstimate({ inputTokens: args.inputTokens, outputTokens: args.outputTokens, cacheHitTokens: args.cacheHitTokens }, comparison, args.summary)
      return {
        window: comparison.window,
        multiplier: comparison.multiplier,
        costNowUsd: roundUsd(comparison.costNowUsd),
        costOffpeakUsd: roundUsd(comparison.costOffpeakUsd),
        savingsUsd: roundUsd(comparison.savingsUsd),
        savingsPercent: comparison.savingsPercent,
        recommendation: comparison.recommendation,
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'offpeak_defer',
    description: 'Add a task to the off-peak defer queue. The task is recorded with the window it was deferred during, an optional token estimate, and the estimated saving of waiting for off-peak. Queue it when a job is not urgent and would be cheaper during off-peak hours.',
    parameters: {
      summary: { type: 'string', required: true, description: 'One-line description of the task to run later' },
      inputTokens: { type: 'number', description: 'Optional estimated input tokens' },
      outputTokens: { type: 'number', description: 'Optional estimated output tokens' },
      cacheHitTokens: { type: 'number', description: 'Optional estimated cache-hit tokens' },
    },
    output: {
      schema: DEFER_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    isConcurrencySafe: () => true,
    execute: async (args) => {
      const now = new Date()
      const entry = runtime.defer({
        summary: args.summary,
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
        cacheHitTokens: args.cacheHitTokens,
      }, now)
      const next = nextSwitchAt(now)
      return {
        entry,
        nextOffpeakStart: {
          at: next.at.toISOString(),
          in: formatDuration(msUntilNextSwitch(now)),
        },
        note: entry.windowAtCreation === 'peak'
          ? 'Deferred during peak. Run it after the next switch to pay the off-peak rate.'
          : 'Already off-peak: consider running it now.',
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'offpeak_queue',
    description: 'Inspect or mutate the off-peak defer queue: list pending tasks, cancel one by id, or remove finished/cancelled entries.',
    parameters: {
      action: { type: 'string', enum: ['list', 'cancel', 'prune'], required: true, description: 'list (default) shows the queue; cancel removes one pending task by id; prune removes terminal entries' },
      id: { type: 'string', description: 'Task id required when action is cancel' },
    },
    output: {
      schema: QUEUE_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    isConcurrencySafe: () => true,
    execute: async (args) => {
      if (args.action === 'cancel') {
        if (args.id === undefined) {
          return { action: 'cancel', queue: summarizeAll(runtime), error: 'offpeak_queue(cancel) requires an id' }
        }
        const updated = runtime.cancel(args.id)
        return { action: 'cancel', queue: summarizeAll(runtime, updated) }
      }
      if (args.action === 'prune') {
        const removed = runtime.store.prune()
        return { action: 'prune', queue: summarizeAll(runtime), removed }
      }
      return { action: 'list', queue: summarizeAll(runtime) }
    },
  })))
  return disposers
}

/** Compact queue rows for model consumption (no internal fields). */
function summarize(entry: { id: string; summary: string; status: string; windowAtCreation: 'peak' | 'offpeak'; savings?: number; createdAt: string }): object {
  return {
    id: entry.id,
    summary: entry.summary,
    status: entry.status,
    deferredDuring: entry.windowAtCreation,
    savingsUsd: entry.savings,
    createdAt: entry.createdAt,
  }
}

/** Summarize the given queue (or the store's current queue, newest first). */
function summarizeAll(runtime: OffpeakRuntime, queue: QueueRow[] = runtime.store.readQueue()): object[] {
  return [...queue].reverse().map(summarize)
}

/** The queue row type accepted by the summarizer (structural). */
type QueueRow = ReturnType<OffpeakRuntime['store']['readQueue']>[number]

/** Parameter schema reference kept for documentation symmetry (all tools take named parameters). */
export type OffpeakToolParameters = ParameterSchemaSpec

/**
 * Human-facing slash commands for dsh-offpeak:
 * - `/offpeak` — one-shot status summary.
 * - `/defer <text>` — enqueue a task for off-peak.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { OffpeakRuntime } from './runtime.ts'
import { formatDuration, formatWallClock, msUntilNextSwitch, nextSwitchAt } from './pricing.ts'

/** Register the plugin's slash commands on `ctx.commands`. */
export function registerCommands(ctx: Context, runtime: OffpeakRuntime): void {
  ctx.commands.register({
    name: 'offpeak',
    description: 'Show the current DeepSeek pricing window, multiplier, next switch, and savings.',
    handler: () => {
      const now = new Date()
      runtime.noteWindowSwitch(now)
      const status = runtime.buildStatus(now)
      const config = runtime.settingsValue()
      const next = nextSwitchAt(now)
      const windowLabel = status.window === 'peak' ? 'PEAK (higher price)' : 'OFF-PEAK (lower price)'
      const currency = status.currency
      const lines = [
        `## Off-peak status`,
        `- Window: **${windowLabel}** — multiplier ×${status.multiplier}`,
        `- Next switch: ${formatWallClock(next.at, config.displayUtcOffsetMinutes)} (display ${config.displayUtcOffsetMinutes >= 0 ? 'UTC+' : 'UTC'}${config.displayUtcOffsetMinutes / 60}) → ${next.to}, in ${formatDuration(msUntilNextSwitch(now))}`,
        `- Effective prices (per 1M tokens): input $${status.prices.inputPerM} · cache-hit $${status.prices.cacheHitPerM} · output $${status.prices.outputPerM} (${currency})`,
        `- Savings today: ${currency === 'CNY' ? '¥' : '$'}${formatCurrency(status.savingsToday, config.cnyPerUsd, currency)}`,
        `- Defer queue: ${status.queue.pending} pending · ${status.queue.done} done · ${status.queue.cancelled} cancelled`,
        `- Ledger: ${status.ledger.total} entries · total savings ${currency === 'CNY' ? '¥' : '$'}${formatCurrency(status.ledger.savingsTotal, config.cnyPerUsd, currency)}`,
        status.window === 'peak'
          ? `> Tip: non-urgent work is ${Math.round((1 - 1 / status.multiplier) * 100)}% cheaper during off-peak. Use \`/defer <task>\` or ask the agent to call \`offpeak_defer\`.`
          : `> You are in off-peak — running expensive work now costs the minimum.`,
      ]
      return { kind: 'success', text: lines.join('\n') }
    },
  })

  ctx.commands.register({
    name: 'defer',
    description: 'Defer a task to off-peak hours: /defer <task description>',
    handler: ({ rawInput }) => {
      const summary = rawInput.trim()
      if (summary === '') {
        return { kind: 'error', text: 'Usage: /defer <task description>' }
      }
      const now = new Date()
      const entry = runtime.defer({ summary }, now)
      const next = nextSwitchAt(now)
      const config = runtime.settingsValue()
      const windowLabel = entry.windowAtCreation === 'peak' ? 'peak' : 'off-peak'
      return {
        kind: 'success',
        text: [
          `Deferred during ${windowLabel}: **${entry.summary}**`,
          `- Next switch: ${formatWallClock(next.at, config.displayUtcOffsetMinutes)} → ${next.to}, in ${formatDuration(msUntilNextSwitch(now))}`,
          `- Queue: ${runtime.store.queueCounts().pending} pending`,
          `- View and manage with \`/offpeak\` or the Settings → Off-peak page.`,
        ].join('\n'),
      }
    },
  })
}

/** Format a USD amount in the configured display currency. */
function formatCurrency(usd: number, cnyPerUsd: number, currency: 'USD' | 'CNY'): string {
  if (currency === 'CNY') {
    return (usd * cnyPerUsd).toFixed(2)
  }
  return usd.toFixed(4)
}

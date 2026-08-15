/**
 * The composer-dock status pill: a live, glassmorphism readout of the current
 * DeepSeek pricing window. It sits in `conversation.composer.dock` (the band
 * under the composer card), computes everything locally from the shared pure
 * pricing engine plus the settings fetched from the host, and reveals a
 * detail tooltip on hover/focus. Renders nothing while disabled.
 */
import { useEffect, useState, type ReactElement } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { LedgerEntry, OffpeakSettings, QueueEntry } from '../contract.ts'
import { formatDuration, multiplierFor, nextSwitchAt, savingsForDay, sumSavings, windowKindAt } from '../pricing.ts'
import { MoonIcon, PulseDot, SunIcon } from './icons.tsx'
import type { OffpeakKey } from './locales.ts'

export interface OffpeakSettingsSnapshot { readonly value: OffpeakSettings }
export interface OffpeakQueueSnapshot { readonly value: QueueEntry[] }
export interface OffpeakLedgerSnapshot { readonly value: LedgerEntry[] }

export type OffpeakSettingsSource = ObservableSnapshot<OffpeakSettingsSnapshot>
export type OffpeakQueueSource = ObservableSnapshot<OffpeakQueueSnapshot>
export type OffpeakLedgerSource = ObservableSnapshot<OffpeakLedgerSnapshot>

/** Injected business face: the live settings/queue/ledger sources. */
export interface OffpeakPillInjected {
  hooks: {
    settings: OffpeakSettingsSource
    queue: OffpeakQueueSource
    ledger: OffpeakLedgerSource
  }
}

/** Full pill entry props: composer-dock owner share + session standard kit + injected face + locale seat. */
export type OffpeakPillProps = PropsRuntime<'conversation.composer.dock'> & InjectFace<OffpeakPillInjected> & PropsLocale<'offpeak'>

/** Format a USD amount in the configured display currency. */
export function formatAmount(usd: number, currency: OffpeakSettings['currency'], cnyPerUsd: number, symbol: string): string {
  if (currency === 'CNY') return `${symbol}${(usd * cnyPerUsd).toFixed(2)}`
  return `${symbol}${usd.toFixed(4)}`
}

/**
 * Render the live pricing pill; null while the settings switch is off.
 * @param props - runtime share, inject hooks, and locale seat.
 * @returns the pill, or null.
 */
export function OffpeakPill({ useSettings, useQueue, useLedger, t }: OffpeakPillProps): ReactElement | null {
  const settings = useSettings(snapshot => snapshot.value)
  const queue = useQueue(snapshot => snapshot.value)
  const ledger = useLedger(snapshot => snapshot.value)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => { setNow(Date.now()) }, 1000)
    return () => { window.clearInterval(timer) }
  }, [])

  if (!settings.enabled) return null

  const date = new Date(now)
  const win = windowKindAt(date)
  const multiplier = multiplierFor(win, settings.peakMultiplier)
  const next = nextSwitchAt(date)
  const countdown = formatDuration(Math.max(0, next.at.getTime() - now))
  const pending = queue.filter(entry => entry.status === 'pending').length
  const savedToday = savingsForDay(ledger, date, settings.displayUtcOffsetMinutes)
  const savedTotal = sumSavings(ledger)
  const symbol = settings.currency === 'CNY' ? t('currencySymbolCny') : t('currencySymbolUsd')
  const windowKey: OffpeakKey = win === 'peak' ? 'window.peak' : 'window.offpeak'
  const nextKey: OffpeakKey = next.to === 'peak' ? 'window.peak' : 'window.offpeak'

  return (
    <div
      className="dsh_offpeak_pill"
      data-window={win}
      role="status"
      tabIndex={0}
      aria-label={t('pill.aria', { window: t(windowKey), multiplier: String(multiplier), countdown })}
    >
      <PulseDot className="dsh_offpeak_pulse" />
      {win === 'peak' ? <SunIcon className="dsh_offpeak_pillIcon" /> : <MoonIcon className="dsh_offpeak_pillIcon" />}
      <span className="dsh_offpeak_pillLabel">{t(windowKey)}</span>
      <span className="dsh_offpeak_pillMultiplier">{t('pill.multiplier', { multiplier: String(multiplier) })}</span>
      <span className="dsh_offpeak_pillCountdown">{t('pill.countdown', { countdown, window: t(nextKey) })}</span>
      {pending > 0 && (
        <span className="dsh_offpeak_pillQueueBadge">{t('pill.queueBadge', { count: String(pending) })}</span>
      )}

      <div className="dsh_offpeak_tooltip" role="tooltip">
        <div className="dsh_offpeak_tooltipTitle">
          <span>{t(windowKey)} · ×{String(multiplier)}</span>
          <span className="dsh_offpeak_tooltipSwitch">
            {t('tooltip.nextSwitch', { window: t(windowKey), nextWindow: t(nextKey), countdown })}
          </span>
        </div>
        <div className="dsh_offpeak_tooltipRow">
          <span className="dsh_offpeak_tooltipLabel">{t('tooltip.effectivePrices')}</span>
          <span />
        </div>
        <div className="dsh_offpeak_tooltipRow">
          <span className="dsh_offpeak_tooltipLabel">{t('tooltip.input')}</span>
          <span className="dsh_offpeak_tooltipValue">
            {symbol}{formatPrice(settings.inputPricePerM * multiplier)}
          </span>
        </div>
        <div className="dsh_offpeak_tooltipRow">
          <span className="dsh_offpeak_tooltipLabel">{t('tooltip.cacheHit')}</span>
          <span className="dsh_offpeak_tooltipValue">
            {symbol}{formatPrice(settings.cacheHitPricePerM * multiplier)}
          </span>
        </div>
        <div className="dsh_offpeak_tooltipRow">
          <span className="dsh_offpeak_tooltipLabel">{t('tooltip.output')}</span>
          <span className="dsh_offpeak_tooltipValue">
            {symbol}{formatPrice(settings.outputPricePerM * multiplier)}
          </span>
        </div>
        <div className="dsh_offpeak_tooltipDivider" />
        <div className="dsh_offpeak_tooltipRow">
          <span className="dsh_offpeak_tooltipLabel">{t('tooltip.savingsToday')}</span>
          <span className="dsh_offpeak_tooltipValue">{formatAmount(savedToday, settings.currency, settings.cnyPerUsd, symbol)}</span>
        </div>
        <div className="dsh_offpeak_tooltipRow">
          <span className="dsh_offpeak_tooltipLabel">{t('tooltip.queue')}</span>
          <span className="dsh_offpeak_tooltipValue">
            {pending > 0 ? t('tooltip.pending', { count: String(pending) }) : '—'}
            {savedTotal > 0 && <span className="dsh_offpeak_tooltipTotal">{formatAmount(savedTotal, settings.currency, settings.cnyPerUsd, symbol)}</span>}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Compact price formatting (4 decimals for base prices, 3 for tiny ones). */
function formatPrice(value: number): string {
  return value >= 0.01 ? value.toFixed(4) : value.toFixed(3)
}

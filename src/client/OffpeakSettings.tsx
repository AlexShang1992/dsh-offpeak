/**
 * The Off-peak settings section (`settings.section`): pricing preferences,
 * the defer-queue manager, and the savings-ledger dashboard with a 7-day bar
 * chart. Every write goes through the injected business face (which persists
 * via the host Remote); components never touch ctx.
 */
import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { LedgerEntry, OffpeakSettings, QueueEntry } from '../contract.ts'
import { savingsForDay, sumSavings } from '../pricing.ts'
import { formatAmount } from './OffpeakPill.tsx'
import type {
  OffpeakLedgerSource,
  OffpeakQueueSource,
  OffpeakSettingsSource,
} from './OffpeakPill.tsx'
import type { OffpeakKey } from './locales.ts'

/** Injected business face: live sources plus durable write verbs. */
export interface OffpeakSectionInjected {
  hooks: {
    settings: OffpeakSettingsSource
    queue: OffpeakQueueSource
    ledger: OffpeakLedgerSource
  }
  updateField: (field: string, value: unknown) => Promise<void>
  cancelQueue: (id: string) => Promise<void>
  clearLedger: () => Promise<void>
  reload: () => Promise<void>
}

/** Full section props: runtime share + injected face + locale seat. */
export type OffpeakSectionProps = PropsRuntime<'settings.section'> & InjectFace<OffpeakSectionInjected> & PropsLocale<'offpeak'>

/** Common UTC offsets offered in the display-timezone select. */
const OFFSET_OPTIONS: readonly { value: number; label: string }[] = [
  { value: -720, label: 'UTC−12' },
  { value: -600, label: 'UTC−10' },
  { value: -480, label: 'UTC−8' },
  { value: -300, label: 'UTC−5' },
  { value: 0, label: 'UTC±0' },
  { value: 60, label: 'UTC+1' },
  { value: 120, label: 'UTC+2' },
  { value: 330, label: 'UTC+5:30' },
  { value: 480, label: 'UTC+8 (北京/Asia/Shanghai)' },
  { value: 540, label: 'UTC+9 (東京/Seoul)' },
  { value: 600, label: 'UTC+10' },
]

const STATUS_KEYS: Record<QueueEntry['status'], OffpeakKey> = {
  pending: 'settings.queueStatusPending',
  done: 'settings.queueStatusDone',
  cancelled: 'settings.queueStatusCancelled',
}

/** Render the Off-peak settings section. */
export function OffpeakSection({
  useSettings,
  useQueue,
  useLedger,
  updateField,
  cancelQueue,
  clearLedger,
  t,
}: OffpeakSectionProps): ReactElement {
  const settings = useSettings(snapshot => snapshot.value)
  const queue = useQueue(snapshot => snapshot.value)
  const ledger = useLedger(snapshot => snapshot.value)
  const [savingField, setSavingField] = useState<string | undefined>(undefined)

  const symbol = settings.currency === 'CNY' ? t('currencySymbolCny') : t('currencySymbolUsd')
  const savedTotal = sumSavings(ledger)
  const savedToday = savingsForDay(ledger, new Date(), settings.displayUtcOffsetMinutes)

  const write = async (field: string, value: unknown): Promise<void> => {
    setSavingField(field)
    try {
      await updateField(field, value)
    } finally {
      setSavingField(undefined)
    }
  }

  const days = useMemo(() => {
    const rows: { label: string; savings: number }[] = []
    const today = new Date()
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(today.getTime() - offset * 86_400_000)
      rows.push({
        label: t(`settings.weekday${(day.getDay() + 6) % 7}` as OffpeakKey),
        savings: savingsForDay(ledger, day, settings.displayUtcOffsetMinutes),
      })
    }
    return rows
  }, [ledger, settings.displayUtcOffsetMinutes, t])

  const maxDay = Math.max(...days.map(day => day.savings), 0)

  return (
    <section className="dsh_offpeak_section" aria-labelledby="dsh-offpeak-settings-title">
      <div>
        <h2 id="dsh-offpeak-settings-title" className="dsh_offpeak_sectionTitle">{t('settings.title')}</h2>
        <p className="dsh_offpeak_sectionSubtitle">{t('settings.subtitle')}</p>
      </div>

      <label className="dsh_offpeak_toggle">
        <span className="dsh_offpeak_toggleText">
          <span className="dsh_offpeak_toggleLabel">{t('settings.enabled')}</span>
          <span className="dsh_offpeak_toggleDesc">{t('settings.enabledDesc')}</span>
        </span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={event => { void write('enabled', event.target.checked) }}
        />
        <span className="dsh_offpeak_switch" aria-hidden="true" />
      </label>

      <div className="dsh_offpeak_card">
        <h3 className="dsh_offpeak_cardTitle">
          {t('settings.pricing')}
          {savingField !== undefined && <span className="dsh_offpeak_saveState">{t('settings.saving')}</span>}
        </h3>
        <p className="dsh_offpeak_cardDesc">{t('settings.pricingDesc')}</p>
        <div className="dsh_offpeak_form">
          <div className="dsh_offpeak_field">
            <span className="dsh_offpeak_fieldLabel">{t('settings.currency')}</span>
            <select
              className="dsh_offpeak_select"
              value={settings.currency}
              disabled={savingField !== undefined}
              onChange={event => { void write('currency', event.target.value) }}
            >
              <option value="USD">{t('settings.currencyUsd')}</option>
              <option value="CNY">{t('settings.currencyCny')}</option>
            </select>
          </div>
          {settings.currency === 'CNY' && (
            <div className="dsh_offpeak_field">
              <span className="dsh_offpeak_fieldLabel">{t('settings.cnyPerUsd')}</span>
              <input
                className="dsh_offpeak_input"
                type="number"
                min={0}
                step={0.01}
                value={settings.cnyPerUsd}
                disabled={savingField !== undefined}
                onChange={event => { void write('cnyPerUsd', Number(event.target.value)) }}
              />
            </div>
          )}
          <div className="dsh_offpeak_field">
            <span className="dsh_offpeak_fieldLabel">{t('settings.inputPrice')}</span>
            <input
              className="dsh_offpeak_input"
              type="number"
              min={0}
              step={0.001}
              value={settings.inputPricePerM}
              disabled={savingField !== undefined}
              onChange={event => { void write('inputPricePerM', Number(event.target.value)) }}
            />
          </div>
          <div className="dsh_offpeak_field">
            <span className="dsh_offpeak_fieldLabel">{t('settings.cacheHitPrice')}</span>
            <input
              className="dsh_offpeak_input"
              type="number"
              min={0}
              step={0.001}
              value={settings.cacheHitPricePerM}
              disabled={savingField !== undefined}
              onChange={event => { void write('cacheHitPricePerM', Number(event.target.value)) }}
            />
          </div>
          <div className="dsh_offpeak_field">
            <span className="dsh_offpeak_fieldLabel">{t('settings.outputPrice')}</span>
            <input
              className="dsh_offpeak_input"
              type="number"
              min={0}
              step={0.001}
              value={settings.outputPricePerM}
              disabled={savingField !== undefined}
              onChange={event => { void write('outputPricePerM', Number(event.target.value)) }}
            />
          </div>
          <div className="dsh_offpeak_field">
            <span className="dsh_offpeak_fieldLabel">{t('settings.peakMultiplier')}</span>
            <input
              className="dsh_offpeak_input"
              type="number"
              min={1}
              max={100}
              step={0.5}
              value={settings.peakMultiplier}
              disabled={savingField !== undefined}
              onChange={event => { void write('peakMultiplier', Number(event.target.value)) }}
            />
            <span className="dsh_offpeak_fieldHint">{t('settings.peakMultiplierDesc')}</span>
          </div>
          <div className="dsh_offpeak_field">
            <span className="dsh_offpeak_fieldLabel">{t('settings.displayOffset')}</span>
            <select
              className="dsh_offpeak_select"
              value={settings.displayUtcOffsetMinutes}
              disabled={savingField !== undefined}
              onChange={event => { void write('displayUtcOffsetMinutes', Number(event.target.value)) }}
            >
              {OFFSET_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <span className="dsh_offpeak_fieldHint">{t('settings.displayOffsetHint')}</span>
          </div>
        </div>
      </div>

      <label className="dsh_offpeak_toggle">
        <span className="dsh_offpeak_toggleText">
          <span className="dsh_offpeak_toggleLabel">{t('settings.remindOnSwitch')}</span>
          <span className="dsh_offpeak_toggleDesc">{t('settings.remindOnSwitchDesc')}</span>
        </span>
        <input
          type="checkbox"
          checked={settings.remindOnSwitch}
          onChange={event => { void write('remindOnSwitch', event.target.checked) }}
        />
        <span className="dsh_offpeak_switch" aria-hidden="true" />
      </label>

      <div className="dsh_offpeak_card">
        <h3 className="dsh_offpeak_cardTitle">{t('settings.queue')}</h3>
        <p className="dsh_offpeak_cardDesc">{t('settings.queueDesc')}</p>
        {queue.length === 0 ? (
          <div className="dsh_offpeak_empty">{t('settings.queueEmpty')}</div>
        ) : (
          <div className="dsh_offpeak_queueList">
            {queue.map(entry => (
              <div className="dsh_offpeak_queueRow" key={entry.id}>
                <div className="dsh_offpeak_queueMain">
                  <span className="dsh_offpeak_queueSummary" title={entry.summary}>{entry.summary}</span>
                  <span className="dsh_offpeak_queueMeta">
                    {t('settings.queueDeferredDuring', {
                      window: t(entry.windowAtCreation === 'peak' ? 'window.peak' : 'window.offpeak'),
                    })}
                    {entry.savings !== undefined && entry.savings > 0
                      ? ` · ${formatAmount(entry.savings, settings.currency, settings.cnyPerUsd, symbol)}`
                      : ''}
                  </span>
                </div>
                <span className={`dsh_offpeak_chip dsh_offpeak_chip${entry.status[0]!.toUpperCase()}${entry.status.slice(1)}`}>
                  {t(STATUS_KEYS[entry.status])}
                </span>
                {entry.status === 'pending' && (
                  <button
                    type="button"
                    className="dsh_offpeak_smallButton dsh_offpeak_smallButtonDanger"
                    onClick={() => { void cancelQueue(entry.id) }}
                  >
                    {t('settings.queueCancel')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dsh_offpeak_card">
        <h3 className="dsh_offpeak_cardTitle">
          {t('settings.ledger')}
          <button
            type="button"
            className="dsh_offpeak_smallButton dsh_offpeak_smallButtonDanger"
            disabled={ledger.length === 0}
            onClick={() => {
              if (window.confirm(t('settings.ledgerClear') + '?')) void clearLedger()
            }}
          >
            {t('settings.ledgerClear')}
          </button>
        </h3>
        <p className="dsh_offpeak_cardDesc">{t('settings.ledgerDesc')}</p>
        <div className="dsh_offpeak_ledgerStats">
          <div className="dsh_offpeak_statCard">
            <div className="dsh_offpeak_statLabel">{t('settings.ledgerSavingsTotal')}</div>
            <div className="dsh_offpeak_statValue">{formatAmount(savedTotal, settings.currency, settings.cnyPerUsd, symbol)}</div>
          </div>
          <div className="dsh_offpeak_statCard">
            <div className="dsh_offpeak_statLabel">{t('settings.ledgerSavingsToday')}</div>
            <div className="dsh_offpeak_statValue">{formatAmount(savedToday, settings.currency, settings.cnyPerUsd, symbol)}</div>
          </div>
          <div className="dsh_offpeak_statCard">
            <div className="dsh_offpeak_statLabel">{t('settings.ledgerEntries')}</div>
            <div className="dsh_offpeak_statValue">{String(ledger.length)}</div>
          </div>
        </div>
        {ledger.length === 0 ? (
          <div className="dsh_offpeak_empty">{t('settings.ledgerEmpty')}</div>
        ) : (
          <div className="dsh_offpeak_chart" role="img" aria-label="7-day savings">
            {days.map(day => (
              <div className="dsh_offpeak_chartBar" key={day.label}>
                <div
                  className="dsh_offpeak_chartFill"
                  style={{ '--dsh-offpeak-bar': maxDay > 0 ? `${Math.max(4, (day.savings / maxDay) * 100)}%` : '4%' } as React.CSSProperties}
                />
                <span className="dsh_offpeak_chartDay">{day.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

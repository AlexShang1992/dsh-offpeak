/**
 * The Off-peak settings section (`settings.section`): the pricing preferences
 * the status pill reads. Every write goes through the injected business face
 * (which persists via the host Remote); components never touch ctx.
 */
import { useState, type ReactElement } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { OffpeakSettingsSource } from './OffpeakPill.tsx'

/** Injected business face: the live settings source plus the durable write. */
export interface OffpeakSectionInjected {
  hooks: {
    settings: OffpeakSettingsSource
  }
  updateField: (field: string, value: unknown) => Promise<void>
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

/** Render the Off-peak settings section. */
export function OffpeakSection({ useSettings, updateField, t }: OffpeakSectionProps): ReactElement {
  const settings = useSettings(snapshot => snapshot.value)
  const [savingField, setSavingField] = useState<string | undefined>(undefined)

  const write = async (field: string, value: unknown): Promise<void> => {
    setSavingField(field)
    try {
      await updateField(field, value)
    } finally {
      setSavingField(undefined)
    }
  }

  const busy = savingField !== undefined

  return (
    <section className="dsh_offpeak_theme dsh_offpeak_section" aria-labelledby="dsh-offpeak-settings-title">
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
          {busy && <span className="dsh_offpeak_saveState">{t('settings.saving')}</span>}
        </h3>
        <p className="dsh_offpeak_cardDesc">{t('settings.pricingDesc')}</p>
        <div className="dsh_offpeak_form">
          <div className="dsh_offpeak_field">
            <span className="dsh_offpeak_fieldLabel">{t('settings.currency')}</span>
            <select
              className="dsh_offpeak_select"
              value={settings.currency}
              disabled={busy}
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
                disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
              onChange={event => { void write('peakMultiplier', Number(event.target.value)) }}
            />
            <span className="dsh_offpeak_fieldHint">{t('settings.peakMultiplierDesc')}</span>
          </div>
          <div className="dsh_offpeak_field">
            <span className="dsh_offpeak_fieldLabel">{t('settings.displayOffset')}</span>
            <select
              className="dsh_offpeak_select"
              value={settings.displayUtcOffsetMinutes}
              disabled={busy}
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
    </section>
  )
}

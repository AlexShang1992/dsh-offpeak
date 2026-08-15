/**
 * Runtime integration tests: OffpeakRuntime wired to a real cordis Context
 * with a scripted settings scope. The service is the whole host surface —
 * two Remote methods over the durable pricing preferences.
 */
import { Context } from '@deepseek-ai/cordis'
import { beforeEach, describe, expect, it } from 'vitest'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import { OffpeakRuntime } from '../src/runtime.ts'
import { defaultOffpeakSettings } from '../src/defaults.ts'
import type { OffpeakSettings } from '../src/contract.ts'

let ctx: Context
let runtime: OffpeakRuntime
let current: OffpeakSettings

/** Scripted settings scope (get/update only — all the runtime uses). */
function fakeSettingsScope(): SettingsScope<OffpeakSettings> {
  return {
    get: () => current,
    update: async (patch: object) => { current = { ...current, ...patch } },
    watch: () => () => {},
    replace: async (section: object) => { current = { ...defaultOffpeakSettings(), ...section } },
  }
}

beforeEach(() => {
  ctx = new Context()
  current = defaultOffpeakSettings()
  runtime = new OffpeakRuntime(ctx, fakeSettingsScope())
})

describe('OffpeakRuntime', () => {
  it('reads the resolved settings', async () => {
    const settings = await runtime.getSettings()
    expect(settings.enabled).toBe(true)
    expect(settings.currency).toBe('USD')
    expect(settings.inputPricePerM).toBeCloseTo(0.28, 10)
    expect(settings.peakMultiplier).toBe(2)
  })

  it('applies one field update and returns the resolved section', async () => {
    const updated = await runtime.updateSettings({ field: 'peakMultiplier', value: 3 })
    expect(updated.peakMultiplier).toBe(3)
    expect(current.peakMultiplier).toBe(3)
    // Untouched fields survive the patch.
    expect(updated.inputPricePerM).toBeCloseTo(0.28, 10)
  })

  it('round-trips every settings field the client can write', async () => {
    await runtime.updateSettings({ field: 'currency', value: 'CNY' })
    await runtime.updateSettings({ field: 'cnyPerUsd', value: 7.3 })
    await runtime.updateSettings({ field: 'inputPricePerM', value: 0.5 })
    await runtime.updateSettings({ field: 'cacheHitPricePerM', value: 0.05 })
    await runtime.updateSettings({ field: 'outputPricePerM', value: 0.9 })
    await runtime.updateSettings({ field: 'displayUtcOffsetMinutes', value: 0 })
    await runtime.updateSettings({ field: 'enabled', value: false })
    expect(await runtime.getSettings()).toEqual({
      enabled: false,
      currency: 'CNY',
      cnyPerUsd: 7.3,
      inputPricePerM: 0.5,
      cacheHitPricePerM: 0.05,
      outputPricePerM: 0.9,
      peakMultiplier: 2,
      displayUtcOffsetMinutes: 0,
    })
  })
})

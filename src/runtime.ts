/**
 * The dsh-offpeak host Remote service (`ctx.offpeak`, wire namespace
 * `offpeak`). Registered as a TypertRemoteService so the Host Gateway's
 * source-mode discovery exports its @Remote methods to the Web client under
 * `/api/offpeak/<method>` with zero generated artifacts.
 *
 * The service owns nothing but the durable settings: the pricing engine is
 * pure and the browser bundles the same copy, so the pill derives the window,
 * the countdown, and the effective prices locally from these values and its
 * own clock. Nothing here is persisted outside the settings store.
 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import type { OffpeakSettings, OffpeakSettingsUpdate } from './contract.ts'
import { applySettingsUpdate } from './defaults.ts'

/** Off-peak service: the durable pricing preferences, read and written. */
export class OffpeakRuntime extends TypertRemoteService {
  /**
   * Register the service under the `offpeak` key (the wire namespace).
   * @param ctx - owning cordis context.
   * @param settings - the live settings scope.
   */
  constructor(
    ctx: Context,
    private readonly settings: SettingsScope<OffpeakSettings>,
  ) {
    super(ctx, 'offpeak')
  }

  /** Live settings (schema defaults + user layer). */
  settingsValue(): OffpeakSettings {
    return this.settings.get()
  }

  /* ---------------- Remote surface (wire namespace `offpeak`) ---------------- */

  /** Read the resolved durable settings. */
  @Remote
  getSettings(): OffpeakSettings {
    return this.settingsValue()
  }

  /** Persist one settings field and return the resolved section. */
  @Remote
  updateSettings(update: OffpeakSettingsUpdate): Promise<OffpeakSettings> {
    return this.settings.update(applySettingsUpdate(this.settingsValue(), update)).then(() => this.settingsValue())
  }
}

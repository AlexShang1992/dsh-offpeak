/**
 * dsh-offpeak locale dictionaries. The namespace key is `offpeak`; both
 * dictionaries must declare exactly the same keys (enforced by the typed
 * registration site and by tests/locales.test.ts).
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** The plugin's locale namespace. */
export const NS = 'offpeak'

/** English dictionary. */
export const en = {
  'window.peak': 'Peak',
  'window.offpeak': 'Off-peak',
  'pill.aria': 'DeepSeek pricing window: {window} (×{multiplier}). Next switch in {countdown}.',
  'pill.multiplier': '×{multiplier}',
  'pill.countdown': '{countdown} until {window}',
  'tooltip.nextSwitch': 'Now {window}: switch to {nextWindow} in {countdown}',
  'tooltip.effectivePrices': 'Effective prices (per 1M tokens)',
  'tooltip.input': 'Input',
  'tooltip.cacheHit': 'Cache hit',
  'tooltip.output': 'Output',
  'tooltip.switchAt': '{window} starts at',
  'settings.title': 'Off-peak',
  'settings.subtitle': 'The pricing window, the peak multiplier, and the prices the pill reads.',
  'settings.enabled': 'Show the pricing pill',
  'settings.enabledDesc': 'Shows the live window readout under the composer.',
  'settings.pricing': 'Pricing',
  'settings.pricingDesc': 'Base (off-peak) prices in USD per 1M tokens; the peak multiplier below applies during peak hours. Official prices change — keep these current with the DeepSeek pricing page.',
  'settings.currency': 'Display currency',
  'settings.currencyUsd': 'USD ($)',
  'settings.currencyCny': 'CNY (¥)',
  'settings.cnyPerUsd': 'USD → CNY rate',
  'settings.inputPrice': 'Input price (cache miss)',
  'settings.cacheHitPrice': 'Cache-hit price',
  'settings.outputPrice': 'Output price',
  'settings.peakMultiplier': 'Peak multiplier',
  'settings.peakMultiplierDesc': 'Price factor applied during peak hours. Official value: 2.',
  'settings.displayOffset': 'Display timezone (UTC offset, minutes)',
  'settings.displayOffsetHint': 'Used to show the switch time, e.g. 480 = UTC+8 (Asia/Shanghai). The window itself is defined in UTC.',
  'settings.saving': 'Saving…',
  'currencySymbolUsd': '$',
  'currencySymbolCny': '¥',
} as const

/** Chinese dictionary. */
export const zh = {
  'window.peak': '高峰',
  'window.offpeak': '错峰',
  'pill.aria': 'DeepSeek 计价时段：{window}（×{multiplier}），{countdown} 后切换。',
  'pill.multiplier': '×{multiplier}',
  'pill.countdown': '{countdown} 后切换{window}',
  'tooltip.nextSwitch': '当前{window}，{countdown} 后切换{nextWindow}',
  'tooltip.effectivePrices': '当前有效价格（每 1M tokens）',
  'tooltip.input': '输入',
  'tooltip.cacheHit': '缓存命中',
  'tooltip.output': '输出',
  'tooltip.switchAt': '{window}开始于',
  'settings.title': '错峰计价',
  'settings.subtitle': '计价时段、高峰倍率，以及浮标读取的价格。',
  'settings.enabled': '显示计价浮标',
  'settings.enabledDesc': '在输入框下方显示当前时段。',
  'settings.pricing': '计价',
  'settings.pricingDesc': '基础（错峰）价格，单位 USD / 1M tokens；高峰时段按下方倍率计价。官方价格会调整，请以 DeepSeek 计价页为准并及时更新。',
  'settings.currency': '显示货币',
  'settings.currencyUsd': '美元（$）',
  'settings.currencyCny': '人民币（¥）',
  'settings.cnyPerUsd': '美元→人民币汇率',
  'settings.inputPrice': '输入价格（缓存未命中）',
  'settings.cacheHitPrice': '缓存命中价格',
  'settings.outputPrice': '输出价格',
  'settings.peakMultiplier': '高峰倍率',
  'settings.peakMultiplierDesc': '高峰时段的价格倍率。官方值为 2。',
  'settings.displayOffset': '显示时区（UTC 偏移，分钟）',
  'settings.displayOffsetHint': '用于展示切换时间，如 480 = UTC+8（北京时间）。时段本身按 UTC 定义。',
  'settings.saving': '保存中…',
  'currencySymbolUsd': '$',
  'currencySymbolCny': '¥',
} as const

/** Typed dictionary union for the `offpeak` namespace. */
export type OffpeakKey = keyof typeof en

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    offpeak: OffpeakKey
  }
}

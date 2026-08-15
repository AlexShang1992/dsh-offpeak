/**
 * Locale dictionary tests. The two dictionaries are user-visible copy that no
 * type or lint check reads, so the failure modes are silent: a key that only
 * one language declares, a key nothing renders, and — the one that reaches
 * the screen as literal `{amount}` text — a placeholder in a string whose
 * call site passes no parameters.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { en, zh, type OffpeakKey } from '../src/client/locales.ts'

const clientDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'client')

/** Every client source, concatenated — the corpus for call-site scanning. */
const sources = readdirSync(clientDir)
  .filter(name => name !== 'locales.ts')
  .map(name => readFileSync(join(clientDir, name), 'utf8'))
  .join('\n')

/** Keys rendered as `t('key')`, with no parameter object. */
const bareCalls = new Set(Array.from(sources.matchAll(/\bt\('([\w.]+)'\)/gu), match => match[1]))
/** Keys rendered as `t('key', { … })`. */
const parameterizedCalls = new Set(Array.from(sources.matchAll(/\bt\('([\w.]+)',\s*\{/gu), match => match[1]))
/** Prefixes of keys composed at runtime, e.g. `settings.weekday${index}`. */
const composedPrefixes = Array.from(sources.matchAll(/`([\w.]+)\$\{/gu), match => match[1]!)

/** Whether some call site can reach this key. */
function isRendered(key: string): boolean {
  return sources.includes(`'${key}'`) || composedPrefixes.some(prefix => key.startsWith(prefix))
}

describe('offpeak locales', () => {
  it('declares the same keys in both languages', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
  })

  it('renders every declared key somewhere', () => {
    for (const key of Object.keys(en)) {
      expect(isRendered(key), `${key} is declared but never rendered`).toBe(true)
    }
  })

  it('keeps placeholders and call sites in agreement', () => {
    for (const [key, value] of Object.entries(en) as [OffpeakKey, string][]) {
      const hasPlaceholder = /\{\w+\}/u.test(value)
      const chinese = zh[key]
      expect(/\{\w+\}/u.test(chinese), `zh '${key}' must take the same parameters as en`).toBe(hasPlaceholder)
      if (bareCalls.has(key)) {
        expect(hasPlaceholder, `'${key}' is rendered with no parameters, so its text must not contain a placeholder`).toBe(false)
      }
      if (parameterizedCalls.has(key)) {
        expect(hasPlaceholder, `'${key}' is rendered with parameters, so its text must use them`).toBe(true)
      }
    }
  })
})

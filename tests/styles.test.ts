/**
 * Stylesheet contract tests. The plugin's colors all resolve through local
 * `--dsh-offpeak-*` tokens declared on one rule, `.dsh_offpeak_theme`; a
 * component root that does not carry that class renders with every color
 * declaration invalid (transparent backgrounds, inherited text), which no
 * type or lint check can see. The stylesheet is also a plain template
 * string, so nothing else notices a rule whose element stopped existing.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { OFFPEAK_STYLE_ID, offpeakStyles } from '../src/client/styles.ts'

const clientDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'client')

/** The component files that render a slot root. */
const ROOTS = ['OffpeakPill.tsx', 'OffpeakSettings.tsx'] as const

/** Every component source, concatenated — the corpus for class-name scanning. */
const components = readdirSync(clientDir)
  .filter(name => name.endsWith('.tsx'))
  .map(name => readFileSync(join(clientDir, name), 'utf8'))
  .join('\n')

describe('offpeak stylesheet', () => {
  it('declares every token it reads', () => {
    const css = offpeakStyles()
    expect(/\.dsh_offpeak_theme\s*\{/u.test(css), 'the .dsh_offpeak_theme rule must exist').toBe(true)
    const declared = new Set(Array.from(css.matchAll(/(--dsh-offpeak-[\w-]+)\s*:/gu), match => match[1]))
    const used = new Set(Array.from(css.matchAll(/var\((--dsh-offpeak-[\w-]+)/gu), match => match[1]))
    for (const token of used) {
      expect(declared.has(token!), `${token} is read but no rule declares it`).toBe(true)
    }
    expect(OFFPEAK_STYLE_ID).toBeTruthy()
  })

  it('reads every token it declares', () => {
    const css = offpeakStyles()
    const declared = new Set(Array.from(css.matchAll(/(--dsh-offpeak-[\w-]+)\s*:/gu), match => match[1]))
    const used = new Set(Array.from(css.matchAll(/var\((--dsh-offpeak-[\w-]+)/gu), match => match[1]))
    for (const token of declared) {
      expect(used.has(token!), `${token} is declared but nothing reads it`).toBe(true)
    }
  })

  it('styles only classes the components render', () => {
    const classes = new Set(Array.from(offpeakStyles().matchAll(/\.(dsh_offpeak_[A-Za-z0-9_]+)/gu), match => match[1]))
    for (const name of classes) {
      expect(components.includes(name!), `.${name} is styled but no component renders it`).toBe(true)
    }
  })

  it('applies the theme class on every component root', () => {
    for (const file of ROOTS) {
      const source = readFileSync(join(clientDir, file), 'utf8')
      expect(source, `${file} must render its root with the token class`).toMatch(/className="dsh_offpeak_theme /u)
    }
  })
})

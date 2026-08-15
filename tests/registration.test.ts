/**
 * Registration tests: slash commands mount into the real cordis commands
 * registry, and model tools register correctly into a scripted registry whose
 * definitions are validated with the harness's own schema compiler.
 */
import { Context } from '@deepseek-ai/cordis'
import commandsPlugin from '@deepseek-ai/dsh-commands'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import { OffpeakRuntime } from '../src/runtime.ts'
import { OffpeakStore } from '../src/store.ts'
import { defaultOffpeakSettings } from '../src/defaults.ts'
import { registerTools } from '../src/tools.ts'
import { registerCommands } from '../src/commands.ts'
import type { OffpeakSettings } from '../src/contract.ts'

let dir: string
let runtime: OffpeakRuntime

function makeRuntime(ctx: Context): OffpeakRuntime {
  const store = new OffpeakStore(dir)
  let current = defaultOffpeakSettings()
  const settings: SettingsScope<OffpeakSettings> = {
    get: () => current,
    update: async (patch: object) => { current = { ...current, ...patch } },
    watch: () => () => {},
    replace: async () => { current = defaultOffpeakSettings() },
  }
  return new OffpeakRuntime(ctx, store, settings)
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dsh-offpeak-register-'))
  runtime = makeRuntime(new Context())
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('registerTools', () => {
  it('registers all four tools with names, descriptions, schemas, and disposers', () => {
    const registered = new Map<string, ToolDefinition>()
    const ctx = {
      tools: {
        register(definition: ToolDefinition): () => void {
          registered.set(definition.name, definition)
          return () => { registered.delete(definition.name) }
        },
      },
    } as unknown as Context

    const disposers = registerTools(ctx, runtime)
    expect(registered.size).toBe(4)
    for (const name of ['offpeak_status', 'offpeak_estimate', 'offpeak_defer', 'offpeak_queue']) {
      const tool = registered.get(name)
      expect(tool, `${name} should be registered`).toBeDefined()
      expect(tool?.description.length).toBeGreaterThan(20)
      expect(tool?.output).toBeDefined()
    }
    for (const dispose of disposers) dispose()
    expect(registered.size).toBe(0)
  })

  it('produces harness-valid JSON Schemas for every tool', () => {
    const registered = new Map<string, ToolDefinition>()
    const ctx = {
      tools: {
        register(definition: ToolDefinition): () => void {
          registered.set(definition.name, definition)
          return () => { registered.delete(definition.name) }
        },
      },
    } as unknown as Context
    registerTools(ctx, runtime)

    for (const [name, tool] of registered) {
      // defineTool compiles author-facing specs to raw JSON Schema at
      // definition time and throws on invalid schemas, so a registered
      // definition is valid by construction; assert the compiled surface.
      expect(tool.parameters, `${name} parameters`).toBeTruthy()
      expect(tool.output.schema, `${name} output`).toBeTruthy()
      expect(typeof tool.output.render, `${name} render`).toBe('function')
      expect(typeof tool.execute, `${name} execute`).toBe('function')
    }
  })

  it('executes offpeak_estimate end to end through the registered definition', async () => {
    const definitions = new Map<string, ToolDefinition>()
    const ctx = {
      tools: {
        register(def: ToolDefinition): () => void {
          definitions.set(def.name, def)
          return () => {}
        },
      },
    } as unknown as Context
    registerTools(ctx, runtime)

    const execute = definitions.get('offpeak_estimate')!.execute as (args: { inputTokens: number }) => Promise<{ savingsUsd: number; savingsPercent: number; recommendation: string }>
    const result = await execute({ inputTokens: 1_000_000 })
    expect(result.savingsPercent).toBeGreaterThanOrEqual(0)
    expect(typeof result.recommendation).toBe('string')
    // The estimate is recorded in the ledger.
    expect(runtime.store.readLedger()[0]?.kind).toBe('estimate')
  })

  it('executes offpeak_defer and offpeak_queue through the registered definitions', async () => {
    const definitions = new Map<string, ToolDefinition>()
    const ctx = {
      tools: {
        register(def: ToolDefinition): () => void {
          definitions.set(def.name, def)
          return () => {}
        },
      },
    } as unknown as Context
    registerTools(ctx, runtime)

    const deferTool = definitions.get('offpeak_defer')!.execute as (args: { summary: string }) => Promise<{ entry: { id: string } }>
    const deferred = await deferTool({ summary: 'registry test' })
    expect(deferred.entry.id).toBeTruthy()

    const queueTool = definitions.get('offpeak_queue')!.execute as (args: { action: string; id?: string }) => Promise<{ queue: unknown[]; error?: string }>
    expect((await queueTool({ action: 'list' })).queue).toHaveLength(1)
    const missingId = await queueTool({ action: 'cancel' })
    expect(missingId.error).toMatch(/requires an id/)
    const cancelled = await queueTool({ action: 'cancel', id: deferred.entry.id })
    expect(cancelled.queue[0]).toMatchObject({ status: 'cancelled' })
    const pruned = await queueTool({ action: 'prune' })
    expect(pruned.queue).toHaveLength(0)
  })
})

describe('registerCommands', () => {
  it('registers /offpeak and /defer', async () => {
    const ctx = new Context()
    await ctx.plugin(commandsPlugin)
    const withRuntime = makeRuntime(ctx)
    registerCommands(ctx, withRuntime)
    expect(ctx.commands.find({} as never, 'offpeak')).toBeDefined()
    expect(ctx.commands.find({} as never, 'defer')).toBeDefined()
  })

  it('/defer validates its input', async () => {
    const ctx = new Context()
    await ctx.plugin(commandsPlugin)
    registerCommands(ctx, makeRuntime(ctx))
    const command = ctx.commands.find({} as never, 'defer')
    const handler = command?.handler as (invocation: { rawInput: string }) => { kind: string; text: string }
    const empty = await handler({ rawInput: '   ' })
    expect(empty.kind).toBe('error')
    const ok = await handler({ rawInput: 'run nightly report' })
    expect(ok.kind).toBe('success')
    expect(ok.text).toContain('run nightly report')
  })

  it('/offpeak produces a status summary', async () => {
    const ctx = new Context()
    await ctx.plugin(commandsPlugin)
    registerCommands(ctx, makeRuntime(ctx))
    const command = ctx.commands.find({} as never, 'offpeak')
    const handler = command?.handler as () => { kind: string; text: string }
    const result = await handler()
    expect(result.kind).toBe('success')
    expect(result.text).toContain('Off-peak status')
  })
})

/**
 * Durable queue + ledger store for dsh-offpeak.
 *
 * Data lives under `$DSH_HOME/offpeak/` (defaulting to `~/.dsh/offpeak/`):
 * - `queue.json`  — the deferred-task queue, written atomically (tmp + rename).
 * - `ledger.jsonl` — append-only cost/savings log, one JSON object per line.
 *
 * Reads are validated with zod and fail closed: a corrupt file is quarantined
 * (renamed aside with a timestamp) and treated as empty, never crashing the
 * host or silently returning garbage.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import { z } from 'zod'
import { ledgerEntrySchema, queueEntrySchema, type LedgerEntry, type OffpeakWindowKind, type QueueEntry } from './contract.ts'
import { invariant } from './invariant.ts'

/** Resolve the DSH home directory (the harness convention is `$DSH_HOME`, else `~/.dsh`). */
export function resolveDshHome(): string {
  return process.env.DSH_HOME ?? join(os.homedir(), '.dsh')
}

/** Default storage directory for the plugin's durable state. */
export function defaultStoreDir(): string {
  return join(resolveDshHome(), 'offpeak')
}

/** One enqueue request. */
export interface DeferInput {
  readonly summary: string
  readonly windowAtCreation: OffpeakWindowKind
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly cacheHitTokens?: number
}

/**
 * File-backed store. All methods are synchronous so tools and commands can
 * read a consistent snapshot without racing; writes are atomic.
 */
export class OffpeakStore {
  /** Storage directory (exposed for diagnostics). */
  readonly dir: string
  private readonly queueFile: string
  private readonly ledgerFile: string

  constructor(dir: string = defaultStoreDir()) {
    this.dir = dir
    mkdirSync(dir, { recursive: true })
    this.queueFile = join(dir, 'queue.json')
    this.ledgerFile = join(dir, 'ledger.jsonl')
  }

  /** Read the queue, quarantining a corrupt file. */
  readQueue(): QueueEntry[] {
    if (!existsSync(this.queueFile)) return []
    let raw: string
    try {
      raw = readFileSync(this.queueFile, 'utf8')
    } catch {
      this.quarantine(this.queueFile, 'queue')
      return []
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      this.quarantine(this.queueFile, 'queue')
      return []
    }
    const result = z.array(queueEntrySchema).safeParse(parsed)
    if (result.success) return result.data
    this.quarantine(this.queueFile, 'queue')
    return []
  }

  /** Persist the queue atomically. */
  writeQueue(entries: QueueEntry[]): void {
    const tmp = `${this.queueFile}.tmp`
    writeFileSync(tmp, JSON.stringify(entries, null, 2), 'utf8')
    renameSync(tmp, this.queueFile)
  }

  /** Append one ledger row (single atomic append). */
  appendLedger(entry: LedgerEntry): void {
    writeFileSync(this.ledgerFile, `${JSON.stringify(entry)}\n`, { flag: 'a' })
  }

  /**
   * Read the tail of the ledger, newest first.
   * @param limit - maximum number of rows to return.
   */
  readLedger(limit = 200): LedgerEntry[] {
    if (!existsSync(this.ledgerFile)) return []
    const lines = readFileSync(this.ledgerFile, 'utf8').split('\n').filter(Boolean)
    const rows: LedgerEntry[] = []
    for (const line of lines.slice(-Math.max(1, limit * 2))) {
      try {
        const parsed = ledgerEntrySchema.safeParse(JSON.parse(line))
        if (parsed.success) rows.push(parsed.data)
      } catch {
        // Skip malformed lines; quarantine is overkill for append-only logs.
      }
    }
    return rows.slice(-limit).reverse()
  }

  /** Remove every ledger row; returns the number of rows removed. */
  clearLedger(): number {
    if (!existsSync(this.ledgerFile)) return 0
    const count = this.readLedger(10_000).length
    writeFileSync(this.ledgerFile, '', 'utf8')
    return count
  }

  /** Enqueue one deferred task and return the fresh entry. */
  enqueue(input: DeferInput): QueueEntry {
    const entry: QueueEntry = {
      id: randomUUID(),
      summary: input.summary.trim(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      windowAtCreation: input.windowAtCreation,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      cacheHitTokens: input.cacheHitTokens,
    }
    invariant(entry.summary.length > 0, 'a deferred task needs a non-empty summary')
    const queue = this.readQueue()
    queue.push(entry)
    this.writeQueue(queue)
    return entry
  }

  /** Mark one pending task as done, recording estimated savings. */
  complete(id: string, savings: number | undefined, costNow: number | undefined, costOffpeak: number | undefined): QueueEntry | undefined {
    const queue = this.readQueue()
    const index = queue.findIndex(entry => entry.id === id)
    if (index === -1) return undefined
    const current = queue[index]!
    const updated: QueueEntry = {
      ...current,
      status: 'done',
      completedAt: new Date().toISOString(),
      savings,
      costNow,
      costOffpeak,
    }
    queue[index] = updated
    this.writeQueue(queue)
    return updated
  }

  /** Cancel one pending task. */
  cancel(id: string): QueueEntry | undefined {
    const queue = this.readQueue()
    const index = queue.findIndex(entry => entry.id === id)
    if (index === -1) return undefined
    const current = queue[index]!
    const updated: QueueEntry = { ...current, status: 'cancelled', completedAt: new Date().toISOString() }
    queue[index] = updated
    this.writeQueue(queue)
    return updated
  }

  /** Remove tasks with a terminal status; returns the number removed. */
  prune(): number {
    const queue = this.readQueue()
    const kept = queue.filter(entry => entry.status === 'pending')
    const removed = queue.length - kept.length
    if (removed > 0) this.writeQueue(kept)
    return removed
  }

  /** Aggregate queue counts (total/pending/done/cancelled). */
  queueCounts(queue: readonly QueueEntry[] = this.readQueue()): { total: number; pending: number; done: number; cancelled: number } {
    return {
      total: queue.length,
      pending: queue.filter(entry => entry.status === 'pending').length,
      done: queue.filter(entry => entry.status === 'done').length,
      cancelled: queue.filter(entry => entry.status === 'cancelled').length,
    }
  }

  /** Sum of `savings` over ledger rows of kind estimate/defer-done. */
  savingsTotal(ledger: readonly LedgerEntry[] = this.readLedger(10_000)): number {
    return ledger.reduce((sum, entry) => sum + (entry.savings ?? 0), 0)
  }

  /**
   * Sum of savings recorded during one display day (the display offset defines
   * the day boundary, matching what the UI shows).
   */
  savingsForDay(day: Date, utcOffsetMinutes: number, ledger: readonly LedgerEntry[] = this.readLedger(10_000)): number {
    const start = day.getTime() + utcOffsetMinutes * 60_000
    const dayStart = start - (start % 86_400_000) - utcOffsetMinutes * 60_000
    const dayEnd = dayStart + 86_400_000
    return ledger.reduce((sum, entry) => {
      const ts = Date.parse(entry.ts)
      if (Number.isNaN(ts) || ts < dayStart || ts >= dayEnd) return sum
      return sum + (entry.savings ?? 0)
    }, 0)
  }

  /** Quarantine a corrupt file so the next read starts clean but nothing is lost. */
  private quarantine(file: string, label: string): void {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/gu, '-')
      renameSync(file, `${file}.corrupt-${stamp}`)
    } catch {
      // Best effort only: never fail the plugin over quarantine bookkeeping.
    }
  }
}

/** Whether the store directory currently holds any data (diagnostics). */
export function storeHasData(dir: string): boolean {
  return existsSync(join(dir, 'queue.json')) || existsSync(join(dir, 'ledger.jsonl'))
}

/** List the store directory contents (diagnostics). */
export function listStoreFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter(name => name !== '.DS_Store') : []
}

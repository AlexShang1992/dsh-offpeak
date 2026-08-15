/**
 * Store tests: durable queue/ledger behavior, atomic writes, and corruption
 * quarantine. Each test runs in its own temp directory.
 */
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OffpeakStore, listStoreFiles, storeHasData } from '../src/store.ts'

let dir: string
let store: OffpeakStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dsh-offpeak-test-'))
  store = new OffpeakStore(dir)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('OffpeakStore', () => {
  it('starts empty', () => {
    expect(store.readQueue()).toEqual([])
    expect(store.readLedger()).toEqual([])
    expect(store.queueCounts()).toEqual({ total: 0, pending: 0, done: 0, cancelled: 0 })
  })

  it('enqueues and persists across instances', () => {
    const entry = store.enqueue({ summary: 'run the full test suite', windowAtCreation: 'peak', inputTokens: 1000 })
    expect(entry.status).toBe('pending')
    expect(entry.id).toBeTruthy()
    expect(entry.summary).toBe('run the full test suite')

    const reopened = new OffpeakStore(dir)
    const queue = reopened.readQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0]).toEqual(entry)
  })

  it('rejects empty summaries', () => {
    expect(() => store.enqueue({ summary: '   ', windowAtCreation: 'peak' })).toThrow(/non-empty/)
  })

  it('cancels a pending task and keeps history', () => {
    const entry = store.enqueue({ summary: 'cleanup', windowAtCreation: 'offpeak' })
    const updated = store.cancel(entry.id)
    expect(updated?.status).toBe('cancelled')
    expect(store.readQueue()[0]?.status).toBe('cancelled')
    expect(store.cancel('missing')).toBeUndefined()
  })

  it('completes a task with savings', () => {
    const entry = store.enqueue({ summary: 'batch export', windowAtCreation: 'peak', inputTokens: 10_000 })
    const done = store.complete(entry.id, 0.0042, 0.0084, 0.0042)
    expect(done?.status).toBe('done')
    expect(done?.savings).toBe(0.0042)
    expect(store.complete('missing', 0, 0, 0)).toBeUndefined()
  })

  it('prunes only terminal entries', () => {
    store.enqueue({ summary: 'a', windowAtCreation: 'peak' })
    const b = store.enqueue({ summary: 'b', windowAtCreation: 'peak' })
    store.cancel(b.id)
    expect(store.prune()).toBe(1)
    expect(store.readQueue()).toHaveLength(1)
    expect(store.prune()).toBe(0)
  })

  it('appends and tails the ledger newest-first', () => {
    for (let index = 0; index < 5; index += 1) {
      store.appendLedger({
        id: `row-${index}`,
        ts: new Date(Date.UTC(2026, 2, 15, 10, index)).toISOString(),
        kind: 'estimate',
        savings: index,
      })
    }
    const tail = store.readLedger(3)
    expect(tail).toHaveLength(3)
    expect(tail[0]?.id).toBe('row-4')
    expect(store.readLedger()).toHaveLength(5)
    expect(store.savingsTotal()).toBe(10)
  })

  it('clears the ledger', () => {
    store.appendLedger({ id: 'x', ts: new Date().toISOString(), kind: 'status' })
    expect(store.clearLedger()).toBe(1)
    expect(store.readLedger()).toEqual([])
    expect(store.clearLedger()).toBe(0)
  })

  it('quarantines a corrupt queue file instead of crashing', () => {
    const queueFile = join(dir, 'queue.json')
    store.enqueue({ summary: 'before corruption', windowAtCreation: 'peak' })
    // Overwrite with garbage.
    writeFileSync(queueFile, '{not json', 'utf8')
    expect(store.readQueue()).toEqual([])
    const files = readdirSync(dir)
    expect(files.some(name => name.startsWith('queue.json.corrupt-'))).toBe(true)
  })

  it('skips malformed ledger lines', () => {
    store.appendLedger({ id: 'good', ts: new Date().toISOString(), kind: 'status' })
    appendFileSync(join(dir, 'ledger.jsonl'), 'not json\n', 'utf8')
    const ledger = store.readLedger()
    expect(ledger).toHaveLength(1)
    expect(ledger[0]?.id).toBe('good')
  })

  it('reports queue counts', () => {
    const a = store.enqueue({ summary: 'a', windowAtCreation: 'peak' })
    const b = store.enqueue({ summary: 'b', windowAtCreation: 'offpeak' })
    store.cancel(b.id)
    store.complete(a.id, 1, 2, 1)
    expect(store.queueCounts()).toEqual({ total: 2, pending: 0, done: 1, cancelled: 1 })
  })

  it('survives restarts with atomic files (no tmp leftovers)', () => {
    store.enqueue({ summary: 'persist me', windowAtCreation: 'peak' })
    store.appendLedger({ id: 'l1', ts: new Date().toISOString(), kind: 'status' })
    expect(readdirSync(dir).sort()).toEqual(['ledger.jsonl', 'queue.json'])
    const reopened = new OffpeakStore(dir)
    expect(reopened.readQueue()).toHaveLength(1)
    expect(reopened.readLedger()).toHaveLength(1)
  })

  it('exposes diagnostics', () => {
    expect(storeHasData(dir)).toBe(false)
    store.enqueue({ summary: 'x', windowAtCreation: 'peak' })
    expect(storeHasData(dir)).toBe(true)
    expect(listStoreFiles(dir)).toContain('queue.json')
    expect(readFileSync(join(dir, 'queue.json'), 'utf8')).toContain('x')
  })
})

# dsh-offpeak

> Off-peak cost autopilot for DeepSeek Harness — peak/off-peak pricing awareness, a defer queue, and a savings ledger for the DSH web GUI.

[English](README.md) | [简体中文](README.zh.md)

![License](https://img.shields.io/github/license/dsh-offpeak/dsh-offpeak)
![CI](https://img.shields.io/github/actions/workflow/status/dsh-offpeak/dsh-offpeak/ci.yml?branch=main)
![Release](https://img.shields.io/github/v/release/dsh-offpeak/dsh-offpeak)
![npm](https://img.shields.io/npm/v/dsh-offpeak)
![Downloads](https://img.shields.io/npm/dm/dsh-offpeak)

## Why

DeepSeek API usage is priced in two daily windows, defined in UTC:

| Window | UTC hours | Price |
| --- | --- | --- |
| **Peak** | 08:30 – 16:30 | `peakMultiplier` × base (official default **2×**) |
| **Off-peak** | 16:30 – 08:30 | base (1×) |

That is a **50% saving** on every non-urgent token — plus lower peak-hour congestion. `dsh-offpeak` makes the window visible, lets you (and your agent) defer expensive work into off-peak, and keeps an honest ledger of the savings you estimated by doing so.

> ⚠️ **Prices change.** Default prices and the multiplier follow the official DeepSeek pricing page at the time of writing; every figure is user-editable in Settings and should be kept current.

## Features

- **Live pricing pill** (composer dock) — current window, ×multiplier, countdown to the next switch, effective prices, today's savings; hover for the full readout.
- **Model tools** — `offpeak_status`, `offpeak_estimate`, `offpeak_defer`, `offpeak_queue` let the agent itself reason about timing and queue work.
- **Slash commands** — `/offpeak` for a status summary, `/defer <task>` to queue a task.
- **Defer queue** — durable, JSON-backed, atomic writes, corrupt-file quarantine; manage it from Settings or via tools.
- **Savings ledger** — append-only JSONL record of estimates and deferrals, with today/total stats and a 7-day chart in Settings.
- **Fully configurable** — prices, multiplier, display currency (USD/CNY), display timezone, all live-applied.
- **Bilingual** (English / 简体中文), theme-aware UI on the harness's own `--dsw-alias-*` tokens.

## Installation

Requires a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web profile (Node.js ≥ 22.19):

```sh
dsh plugin --profile web add dsh-offpeak
```

Or from a Git repository:

```sh
dsh plugin --profile web add "github:dsh-offpeak/dsh-offpeak"
```

Restart `dsh --profile web` after installing. The plugin shows up under **Settings → Plugins → Off-peak**; the pill appears under the composer.

> Data lives in `$DSH_HOME/offpeak/` (`~/.dsh/offpeak/` by default): `queue.json` + `ledger.jsonl`. Uninstall cleanly by removing the plugin — your queue and ledger files are kept.

## Usage

### For humans

- `/offpeak` — one-shot status summary in the conversation.
- `/defer <task description>` — add a task to the queue (e.g. `/defer run the full regression suite`).
- Hover the pill to see prices and savings; open **Settings → Off-peak** for the full panel.

### For the agent

The tools are registered automatically; the model will call them when relevant:

| Tool | Purpose |
| --- | --- |
| `offpeak_status` | Current window, multiplier, countdown, prices, savings, queue counts |
| `offpeak_estimate` | Cost of a request now vs off-peak (records a ledger row) |
| `offpeak_defer` | Enqueue a task with optional token estimates |
| `offpeak_queue` | List, cancel, or prune the queue |

## Settings reference

| Setting | Default | Meaning |
| --- | --- | --- |
| Enabled | `true` | Show the pill and power the queue/ledger |
| Currency | `USD` | Display currency (`USD` or `CNY`; uses the USD→CNY rate) |
| Input / cache-hit / output price | `0.28 / 0.028 / 0.42` | Base (off-peak) prices, USD per 1M tokens |
| Peak multiplier | `2` | Price factor during peak hours |
| Display timezone | `480` (UTC+8) | UTC offset in minutes, used only to display switch times |
| Record window switches | `true` | Append a status row when the window changes |

## Development

```sh
pnpm install          # install dependencies
pnpm run check        # typecheck + test + lint + build (CI-equivalent)
pnpm run test:watch   # iterate on tests
```

Structure:

```
src/
  pricing.ts     pure pricing engine (window math, cost estimates) — host & browser
  contract.ts    wire contract: settings/queue/ledger types, zod codecs, Typert invocations
  store.ts       durable queue + ledger (atomic writes, corruption quarantine)
  runtime.ts     OffpeakRuntime — the `offpeak` Typert Remote service
  tools.ts       model tools (offpeak_status/estimate/defer/queue)
  commands.ts    slash commands (/offpeak, /defer)
  index.ts       host plugin entry
  client/        browser half: status pill, settings section, zh/en locales, styles
tests/           unit tests (pricing boundaries, store durability)
```

Build artifacts: `lib/index.js` (host ESM), `lib/client.js` (browser bundle served at `/plugins/dsh-offpeak/client.js`), `lib/types/` (declarations).

## Architecture

- **One source of truth**: the pricing engine in `src/pricing.ts` is pure and dependency-free; the same code runs in the host and is bundled into the browser, so every surface agrees by construction.
- **Strict wire contract**: host and client share zod codecs and Typert invocation descriptors (`src/contract.ts`); every Remote call is validated on the wire.
- **Live settings**: the `offpeak` settings namespace applies changes without a restart (`applies: 'live'`); tools, commands, and the UI read the same resolved value.
- **Fail-closed storage**: corrupt files are quarantined (never crash, never silently return garbage); writes are atomic (tmp + rename).

## Roadmap

- [ ] Off-peak scheduling: auto-run queued tasks in fresh headless sessions at window switch
- [ ] Peak/off-peak-aware model routing (expensive models only during off-peak)
- [ ] Budget caps + over-budget alerts
- [ ] Weekly savings report
- [ ] One-click sync of official prices

## Security

Installing a plugin runs third-party code with your permissions. This plugin writes only under `$DSH_HOME/offpeak/` and reads nothing outside it; no network calls are made. See [SECURITY.md](SECURITY.md) for reporting guidelines.

## License

[MIT](LICENSE) © dsh-offpeak contributors. Not affiliated with DeepSeek.

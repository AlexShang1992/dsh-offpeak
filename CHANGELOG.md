# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are cut automatically by release-please from Conventional Commit
messages; this file is maintained for human readability.

## [Unreleased]

### Added

- Initial release: `dsh-offpeak` v0.1.0 — off-peak cost autopilot for DeepSeek Harness.

### Features

- Live pricing pill in the composer dock (window, multiplier, countdown, prices, savings).
- Model tools: `offpeak_status`, `offpeak_estimate`, `offpeak_defer`, `offpeak_queue`.
- Slash commands: `/offpeak`, `/defer <task>`.
- Durable defer queue with atomic writes and corrupt-file quarantine.
- Append-only savings ledger with today/total stats and a 7-day chart.
- Fully configurable prices, peak multiplier, display currency, and display timezone (live-applied).
- Bilingual UI (English / 简体中文) on harness theme tokens.

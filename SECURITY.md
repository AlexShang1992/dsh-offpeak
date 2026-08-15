# Security policy

## Supported versions

Fixes land on the latest release only. Upgrade before reporting a problem you
found on an older version.

## Reporting a vulnerability

Report privately through GitHub's private vulnerability reporting:
**[Security → Report a vulnerability](https://github.com/AlexShang1992/dsh-offpeak/security/advisories/new)**.
Please do not open a public issue for a security problem.

Include the affected version, your OS and Node.js version, the `dsh` version,
and a minimal reproduction. You will get an acknowledgement within a week, and
credit in the release notes unless you would rather stay anonymous.

## What this plugin does

Installing any plugin runs third-party code with your own permissions. This one:

- **Writes no files.** Its only durable state is its own `offpeak` settings
  section, persisted by the harness's settings provider.
- **Reads** nothing but that section.
- **Makes no network calls**, and collects no analytics, crash reports, or
  usage data.
- **Registers no tools and no commands**, so it can neither be invoked by a
  model nor put anything into a model request.

Anything else — a file write, an outbound request, any data collection — is a
security bug worth reporting under this policy.

## Threat model

- **Untrusted settings values.** Every value crossing the Remote is validated
  against the zod codecs in `src/contract.ts` in both directions; a section the
  schema rejects keeps the last good value rather than reaching the UI.
- **Untrusted text in the UI.** The plugin renders only its own translated
  strings and numbers formatted from settings, as React text nodes; it uses no
  `dangerouslySetInnerHTML` and builds no HTML from strings.
- **The prices are not authoritative.** They are what a user typed. Never treat
  the pill as a billing record or a spend control.
- **Dependencies.** Runtime dependencies are `zod` and
  `@deepseek-ai/schemastery`, pinned by `pnpm-lock.yaml`. Review Dependabot
  updates before merging them.

## Disclosure

Please give a reasonable window — 90 days by default — before publishing, and
do not exploit an issue beyond what demonstrating it requires.

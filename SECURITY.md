# Security Policy

## Supported versions

Security fixes are backported to the latest release only. Please upgrade to the
newest version promptly.

| Version | Supported |
| --- | --- |
| latest (>= 0.1.0) | ✅ |
| older | ❌ |

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities. Report
privately instead:

- **Email**: security@dsh-offpeak.dev (placeholder — replace with a real
  address before enabling)
- **GitHub**: use the private vulnerability reporting flow at
  https://github.com/dsh-offpeak/dsh-offpeak/security/advisories (requires a
  real repository to be enabled)

Include, if possible:

1. The affected version(s) and environment (OS, Node.js version, dsh version).
2. A minimal reproduction: what you did, what happened, what you expected.
3. Whether the issue is exploitable remotely, locally, or only by a trusted
   local user (most plugin issues are local-only).

You should receive an acknowledgment within 72 hours and a fix timeline within
7 days. We will credit you in the release notes unless you prefer anonymity.

## Scope

This plugin is a DeepSeek Harness plugin: installing it runs third-party code
with your own permissions, and it has the same trust level as any other plugin.
This policy covers the `dsh-offpeak` codebase itself.

### What the plugin does and does not do

- **Writes** only under `$DSH_HOME/offpeak/` (`~/.dsh/offpeak/` by default):
  `queue.json` and `ledger.jsonl`.
- **Reads** only those two files.
- **Network**: none. The plugin makes no outbound requests.
- **Telemetry**: none. No analytics, no crash reporting, no anonymous usage
  data.

Any deviation from the above — a write or read outside `$DSH_HOME/offpeak/`,
an unexpected network call, or unexpected data collection — is a security bug
and should be reported under this policy.

## Threat model notes

- **Corrupt or hostile data files**: the store validates every read with zod
  and quarantines corrupt files rather than crashing or returning garbage.
  A hostile `queue.json` cannot execute code or influence anything outside the
  plugin's own reads.
- **Malicious model input**: like all plugins, this one renders data that may
  originate from untrusted conversations. The UI escapes all text content;
  no `dangerouslySetInnerHTML` is used.
- **Supply chain**: dependencies are kept minimal (`zod`,
  `@deepseek-ai/schemastery`) and are pinned by `pnpm-lock.yaml`. Review
  dependency updates in Dependabot PRs carefully.

## Responsible disclosure

We ask for responsible disclosure: give us a reasonable window (default 90
days) before publicizing a vulnerability, and do not exploit it beyond what is
needed to demonstrate the issue.

Thank you for helping keep the ecosystem safe.

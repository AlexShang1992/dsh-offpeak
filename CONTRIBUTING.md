# Contributing

Thanks for taking the time. This is a DeepSeek Harness plugin and follows the
conventions of the harness's own packages: one gate, bilingual docs kept in
step, and contracts pinned by tests rather than by review memory.

## Getting started

```sh
pnpm install          # installs and builds (the prepare script runs the build)
pnpm run check        # typecheck + test + lint + build — the same gate CI runs
```

Node.js ≥ 22.19 and pnpm 10. Branch from `main`, keep one logical change per
pull request, and run `pnpm run check` before pushing; CI repeats it on Node
22, 24, and 26.

## Trying a change in a real harness

Unit tests do not exercise the harness seams that break most often — tool
output validation, command argument claiming, slot rendering, theme tokens.
Install the working copy into a Web profile and look at it:

```sh
dsh plugin --profile web add "file:$PWD"
dsh --profile web --port 3081        # a spare port, so your usual instance stays up
```

The host half is loaded into memory at boot: restart that process after
changing anything under `src/` that is not `src/client/`. The browser bundle is
served from disk, so a page reload picks it up.

## Conventions

- **Comments and code in English.** User-facing copy lives in
  `src/client/locales.ts` and must be written in both English and Simplified
  Chinese; the two dictionaries declare exactly the same keys.
- **The pricing engine stays pure.** Anything about windows, prices, or
  durations belongs in `src/pricing.ts` as a pure function with tests. The
  browser bundles that same file, so it must never import a Node API.
- **Wire contracts are strict.** A new Remote method needs a zod codec in
  `src/contract.ts`, a descriptor in `OFFPEAK_INVOCATIONS`, and a member in the
  Typert manifest (`src/typert.ts`). Values crossing that boundary must be
  lossless JSON: a key present with the value `undefined` is rejected there.
- **The plugin stays a display surface.** It registers no tools or commands and
  writes no files; a change that adds either is a change of scope, not a
  feature — open an issue first.
- **Colours come from tokens.** No literal colours in components. Styles live
  in `src/client/styles.ts` under the `dsh_offpeak_` prefix, read the harness's
  `--dsw-alias-*` scale, and every component root carries `dsh_offpeak_theme`.
  Check a change in both the light and dark themes.

## Tests

Put a test next to the behaviour: `tests/pricing.test.ts` for the window math,
`tests/runtime.test.ts` for the Remote surface, and `tests/styles.test.ts` and
`tests/locales.test.ts` for the contracts a compiler cannot see. Boundary
instants (08:30:00.000 and 16:29:59.999 UTC, midnight rollover) deserve
explicit cases.

## Documentation

`README.md` and `README.zh.md` are a bilingual pair with equal authority. Edit
one, bring the other along, and re-record both blob hashes in
`README.i18n.yaml`:

```sh
git hash-object README.md README.zh.md
```

Screenshots have their own rules — see [docs/screenshots/README.md](docs/screenshots/README.md).

## Commits and releases

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
`docs:`, `test:`, `refactor:`, with a `BREAKING CHANGE:` footer for a major
bump. release-please cuts releases and writes `CHANGELOG.md` from those
messages, so do not edit the changelog by hand.

## Code of conduct

Everyone taking part is bound by the [Code of Conduct](CODE_OF_CONDUCT.md).

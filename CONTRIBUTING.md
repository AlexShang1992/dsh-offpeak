# Contributing to dsh-offpeak

Thanks for taking the time to contribute! This project follows the conventions of the DeepSeek Harness plugin ecosystem and aims to keep the bar high: every PR is typechecked, linted, tested, and built.

## Getting started

1. Fork the repository and clone your fork.
2. Install dependencies: `pnpm install` (pnpm 9+ recommended; Node.js ≥ 22.19).
3. Run the full local gate before touching anything to confirm a green baseline:

   ```sh
   pnpm run check
   ```

4. Create a branch: `git switch -c feat/your-feature`.

## What to work on

- Check the [issues](https://github.com/dsh-offpeak/dsh-offpeak/issues) for `good first issue` labels.
- See the [roadmap](README.md#roadmap) in the README for planned features.
- If you plan a non-trivial change, open an issue first to discuss the approach.

## Development workflow

```sh
pnpm run typecheck    # TypeScript strict check (src + tests)
pnpm run test         # vitest unit tests
pnpm run test:watch   # iterate
pnpm run lint         # oxlint
pnpm run build        # esbuild bundles + type declarations
pnpm run check        # all of the above, CI-equivalent
```

### Conventions

- **Code comments in English**; user-facing copy in both English and Simplified Chinese (`src/client/locales.ts` — the two dictionaries must stay key-identical).
- **Pure logic stays pure**: anything timezone/pricing related belongs in `src/pricing.ts` as a pure function with tests. The browser bundles the same file, so it must never import Node APIs.
- **Wire contracts are strict**: any new Remote method needs a zod codec in `src/contract.ts`, a descriptor in `OFFPEAK_INVOCATIONS`, and a member in the Typert manifest (`src/typert.ts`).
- **Storage fails closed**: new files must be validated on read and never crash the host on corruption.
- **CSS tokens only**: no literal colors in components; styles live in `src/client/styles.ts` under the `dsh_offpeak_` prefix.

### Testing

- Add tests next to the behavior: `tests/pricing.test.ts` for the engine, `tests/store.test.ts` for durability.
- Boundary times (08:30:00.000 / 16:29:59.999 UTC, midnight rollover) deserve explicit cases.
- Storage tests must run in a temp directory (see the existing suite) — never in the user's real `~/.dsh`.

## Commit conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add off-peak auto-scheduler
fix(store): quarantine corrupt ledger lines
docs: clarify default prices
test(pricing): cover midnight rollover
```

Releases are cut from `feat`/`fix` commits by release-please; a `BREAKING CHANGE:` footer bumps the major version.

## Pull requests

- Fill in the PR template; keep changes focused — one logical change per PR.
- Run `pnpm run check` locally before pushing; CI runs it again on Node 22/24/26.
- Update the README (both languages) when user-facing behavior changes.
- Add a CHANGELOG entry only if the maintainers ask — release-please generates it from commit messages.

## Code of conduct

All participants must follow the [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful, constructive, and kind.

## Questions?

Open a [discussion](https://github.com/dsh-offpeak/dsh-offpeak/discussions) or an issue. Thanks again!

# Agent guide

pnpm + Turborepo monorepo. Node >= 22.13 to develop. TypeScript everywhere.

## Layout

- `packages/ts-extended-errors` — the library, published to GitHub Packages as
  `@rxova/ts-extended-errors`. It supports Node >= 20.19, so it builds for Node 20, not the
  preset's 22.
- `packages/*` — workspace packages, built dual ESM + CJS with tsdown.
- `packages/config` — the shared vitest and tsdown presets. Coverage thresholds live here only.
- `packages/tooling` — repo scripts (`verify`, `pack-smoke`, `check-llms`, `check-changeset`).
- `.changeset` — pending release notes. A change to the library adds one (`pnpm changeset`); CI
  checks. A pull request that publishes nothing (a dev dependency bump) is labelled `skip-changeset`.
- `apps/*` — applications, when there are any.

## Commands

- `pnpm run verify` — the full gate, same order as CI. Run it before saying work is done.
- `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm format` — the pieces.
- `pnpm --filter <package> test` — one package.
- `pnpm run check:llms` — each `llms.txt` against the package exports; part of `verify`.

## Rules

- Source in `src/`, tests in `src/**/__tests__/`. `src/index.ts` re-exports only, `src/types.ts`
  holds types only — both are excluded from coverage, so logic there is logic nobody measures.
- Coverage is 95% per file; raise thresholds, never lower them.
- Never skip, delete or weaken a test to make a change pass.
- Never make a test pass by hardcoding its expected answer or switching a check off.
- ESLint runs `strictTypeChecked`. Fix the finding rather than disabling the rule; if a disable is
  truly needed, scope it to one line and say why.
- Conventional Commits; subject line only. Never `--no-verify`.

## Agent-facing files

| File                                    | Read by                                                      | Kept in step by                                                                                       |
| --------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `packages/ts-extended-errors/llms.txt`  | An agent using the library, from `node_modules`              | `check-llms`: the `## API` table matches `src/index.ts` both ways; `pack-smoke`: it is in the tarball |
| `packages/ts-extended-errors/README.md` | People, and agents that follow the `llms.txt` link           | Nothing automatic: type-check and run an example after changing it                                    |
| `llms.txt`                              | An agent that reaches the repository rather than the package | `check-llms`: it links every published package's `llms.txt`                                           |
| `AGENTS.md`                             | An agent editing this repository                             | —                                                                                                     |

`llms.txt` is hand-written. A renamed export fails `check-llms` until the table is updated, so
rename the export and update the table in the same commit.

## Change these together

A change to the public API ships in one pull request with:

- the code and its tests
- the TSDoc
- the README section for the export
- the `## API` table, example or mistakes in `packages/ts-extended-errors/llms.txt`
- a changeset

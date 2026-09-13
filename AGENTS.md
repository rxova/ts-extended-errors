# Agent guide

pnpm + Turborepo monorepo. Node >= 22.13 to develop. TypeScript everywhere.

## Layout

- `packages/ts-extended-errors` — the library, the one package meant to be published. It supports
  Node >= 20.19, so it builds for Node 20, not the preset's 22.
- `packages/*` — workspace packages, built dual ESM + CJS with tsdown.
- `packages/config` — the shared vitest and tsdown presets. Coverage thresholds live here only.
- `packages/tooling` — repo scripts (`verify`, `pack-smoke`).
- `.changeset` — pending release notes. A change to the library adds one (`pnpm changeset`).
- `apps/*` — applications, when there are any.

## Commands

- `pnpm run verify` — the full gate, same order as CI. Run it before saying work is done.
- `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm format` — the pieces.
- `pnpm --filter <package> test` — one package.

## Rules

- Source in `src/`, tests in `src/**/__tests__/`. `src/index.ts` re-exports only, `src/types.ts`
  holds types only — both are excluded from coverage, so logic there is logic nobody measures.
- Coverage is 95% per file; raise thresholds, never lower them.
- Never skip, delete or weaken a test to make a change pass.
- Never make a test pass by hardcoding its expected answer or switching a check off.
- ESLint runs `strictTypeChecked`. Fix the finding rather than disabling the rule; if a disable is
  truly needed, scope it to one line and say why.
- Conventional Commits; subject line only. Never `--no-verify`.

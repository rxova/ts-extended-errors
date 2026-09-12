# Agent guide

pnpm + Turborepo monorepo. Node >= 22.13. TypeScript everywhere. Nothing here is published.

## Layout

- `packages/*` — workspace packages, built dual ESM + CJS with tsdown.
- `packages/config` — the shared vitest and tsdown presets. Coverage thresholds live here only.
- `packages/tooling` — repo scripts (`verify`).
- `apps/*` — applications, when there are any.
- `vendor/basting` — basting's build, vendored because it is not on npm. `PROVENANCE.json`
  records the source commit and checksums; to update, copy a new build and its provenance over it.

## Commands

- `pnpm run verify` — the full gate, same order as CI. Run it before saying work is done.
- `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm format` — the pieces.
- `pnpm --filter <package> test` — one package.

## Rules

- Source in `src/`, tests in `src/**/__tests__/`. `src/index.ts` re-exports only, `src/types.ts`
  holds types only — both are excluded from coverage, so logic there is logic nobody measures.
- Coverage is 95% per file; raise thresholds, never lower them.
- Never skip, delete or weaken a test to make a change pass. overlock checks for exactly that, in
  the Stop hook, in `verify`, and in CI.
- Never make a test pass by hardcoding its expected answer or switching a check off. basting checks
  for that, in the Stop hook and in `verify`.
- ESLint runs `strictTypeChecked`. Fix the finding rather than disabling the rule; if a disable is
  truly needed, scope it to one line and say why.
- Conventional Commits; subject line only. Never `--no-verify`.

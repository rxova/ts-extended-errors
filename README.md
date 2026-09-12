# template-private

Template for private TypeScript projects: a pnpm + Turborepo monorepo whose CI is built to spend as
few billed Actions minutes as possible.

## What is in it

| Piece              | Details                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/example` | Dual ESM + CJS package built with tsdown; publint + attw                                                                                      |
| `packages/config`  | Shared vitest and tsdown presets — the one home of the 95%-per-file coverage thresholds                                                       |
| `packages/tooling` | `verify`: the gate the pre-push hook and CI both run, including overlock (test integrity) and basting (fake implementations)                  |
| `vendor/basting`   | basting's build, vendored because it is not on npm; `PROVENANCE.json` records the source commit and checksums                                 |
| Quality            | TypeScript 6 strict, ESLint 10 with `strictTypeChecked`, Prettier, Vitest 5                                                                   |
| Hooks              | Husky: lint-staged + typecheck + tests on commit, commitlint, `verify` on push                                                                |
| Agent hooks        | Claude Code Stop hooks for overlock, saidso and basting (`.claude/`)                                                                          |
| CI                 | One job plus an `all checks` gate, Turbo remote cache in the Actions cache, overlock comment on PRs, audit after build                        |
| Dependabot         | Weekly, one grouped PR per ecosystem, at most one open; patch/minor updates auto-merge once `all checks` passes (`dependabot-auto-merge.yml`) |

## Where the minutes go

- **One job.** Jobs are billed rounded up to the minute, each with its own checkout and install.
- **Turbo remote cache** backed by the Actions cache, so unchanged packages replay rather than rerun.
- **Cancel superseded runs**, and no `edited` trigger: a PR description edit costs nothing, a title
  edit costs one small job (`pr-title.yml`).
- **Pushes to main** that only touch a changelog or the license do not run.
- **Dependabot** opens at most one grouped PR per ecosystem per week.
- **No matrix, no CodeQL, no docs deploy, no release pipeline.** Add them when a project needs
  them; the open-source template (`rxova/template-oss`) has all of them.

## After creating a repository from this template

1. Replace the template's name, and rename the example package:
   ```sh
   grep -rl template-private --exclude-dir=node_modules --exclude-dir=.git . | xargs sed -i '' 's/template-private/<repo>/g'
   git mv packages/example packages/<name>   # then update "name"
   ```
   The `@repo/` scope is a placeholder too; replace it the same way if you want your own.
2. `pnpm install`
3. **Branch protection** on `main`: require the `all checks` and `commit message (PR title)` checks.

## Commands

```sh
pnpm install        # dependencies and git hooks
pnpm test           # unit tests, coverage enforced per file
pnpm run verify     # everything CI runs, in order
```

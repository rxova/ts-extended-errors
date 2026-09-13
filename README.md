# ts-extended-errors

Typed, serializable errors for TypeScript. The library, its README and its API live in
[`packages/ts-extended-errors`](packages/ts-extended-errors); this root is the workspace around it.

It moved here from `rxova/experiments` (`packages/ts-extended-errors`) with its commit history.

## What is in it

| Piece                         | Details                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ts-extended-errors` | The library: dual ESM + CJS built with tsdown, checked with publint + attw                                                                    |
| `packages/config`             | Shared vitest and tsdown presets — the one home of the 95%-per-file coverage thresholds                                                       |
| `packages/tooling`            | `verify`: the gate the pre-push hook and CI both run                                                                                          |
| Quality                       | TypeScript 6 strict, ESLint 10 with `strictTypeChecked`, Prettier, Vitest 5                                                                   |
| Hooks                         | Husky: lint-staged + typecheck + tests on commit, commitlint, `verify` on push                                                                |
| CI                            | One job plus an `all checks` gate, Turbo remote cache in the Actions cache, audit after build                                                 |
| Dependabot                    | Weekly, one grouped PR per ecosystem, at most one open; patch/minor updates auto-merge once `all checks` passes (`dependabot-auto-merge.yml`) |

## Where the minutes go

- **One job.** Jobs are billed rounded up to the minute, each with its own checkout and install.
- **Turbo remote cache** backed by the Actions cache, so unchanged packages replay rather than rerun.
- **Cancel superseded runs**, and no `edited` trigger: a PR description edit costs nothing, a title
  edit costs one small job (`pr-title.yml`).
- **Pushes to main** that only touch a changelog or the license do not run.
- **Dependabot** opens at most one grouped PR per ecosystem per week.
- **No matrix, no CodeQL, no docs deploy, no release pipeline.** Add them when the library needs
  them; the open-source template (`rxova/template-oss`) has all of them.

## Commands

```sh
pnpm install                          # dependencies and git hooks
pnpm test                             # unit tests, coverage enforced per file
pnpm --filter ts-extended-errors test # the library alone
pnpm run verify                       # everything CI runs, in order
```

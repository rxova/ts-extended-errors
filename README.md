# ts-extended-errors

Typed, serializable errors for TypeScript. The library, its README and its API live in
[`packages/ts-extended-errors`](packages/ts-extended-errors); this root is the workspace around it.

It moved here from `rxova/experiments` (`packages/ts-extended-errors`) with its commit history.

## What is in it

| Piece                         | Details                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ts-extended-errors` | The library: dual ESM + CJS built with tsdown, checked with publint + attw                                                                    |
| `packages/config`             | Shared vitest and tsdown presets — the one home of the 95%-per-file coverage thresholds                                                       |
| `packages/tooling`            | `verify`: the gate the pre-push hook and CI both run; `pack-smoke`: installs the packed tarball and loads it with plain Node                  |
| Releases                      | Changesets; `release.yml` publishes to npm with provenance once `RELEASE_ENABLED` is `true`                                                   |
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
- **No matrix.** The tarball is loaded on the Node in `.nvmrc` and again on the `engines` floor, in
  the same job.
- **No CodeQL, no docs deploy.** Add them when the library needs them; the open-source template
  (`rxova/template-oss`) has both.

## Commands

```sh
pnpm install                          # dependencies and git hooks
pnpm test                             # unit tests, coverage enforced per file
pnpm --filter ts-extended-errors test # the library alone
pnpm run verify                       # everything CI runs, in order
pnpm run pack:smoke                   # pack, install and load the tarball
pnpm changeset                        # record a change to the library for the next release
```

## Releases

1. A pull request that changes the library adds a changeset (`pnpm changeset`).
2. Once CI passes on `main`, `release.yml` opens a `chore: version packages` pull request with the
   version bump and changelog.
3. Merging that pull request publishes to npm with provenance and tags the release.

Publishing is off until the repository variable `RELEASE_ENABLED` is `true`. Before that, add the
repository and `release.yml` as a trusted publisher of `ts-extended-errors` on npm.

# ts-extended-errors

[![CI](https://github.com/rxova/ts-extended-errors/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/rxova/ts-extended-errors/actions/workflows/ci.yml)

**Typed, serializable errors for TypeScript.** This repository holds one published package,
[`@rxova/ts-extended-errors`](packages/ts-extended-errors): a base class for custom errors, a
one-line class factory, helpers for `cause` chains, and a JSON round trip that rebuilds the original
classes. Node.js 20.19 or newer, browsers too, no runtime dependencies, ESM and CommonJS. MIT.

```ts
import {
  defineError,
  deserializeError,
  findCauseOf,
  serializeError,
} from '@rxova/ts-extended-errors'

const HttpError = defineError('HttpError', { code: 'HTTP' })
const NotFoundError = defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })

const error = new HttpError('loading the profile failed', {
  cause: new NotFoundError('no such user', { context: { userId: 42 } }),
})

findCauseOf(error, NotFoundError)?.context // { userId: 42 }

// Through JSON and back, as the same classes
const line = JSON.stringify(serializeError(error, { includeStack: false }))
const back = deserializeError(JSON.parse(line), { classes: [HttpError, NotFoundError] })
back.cause instanceof NotFoundError // true
```

## Install

The package is published to GitHub Packages, not npmjs.com. Route the `@rxova` scope there in the
`.npmrc` of the project that installs it, with a GitHub token that has `read:packages`:

```ini
@rxova:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
npm install @rxova/ts-extended-errors
```

## Documentation

- [Package README](packages/ts-extended-errors/README.md): an example for every export, and the
  options and types tables.
- [Changelog](packages/ts-extended-errors/CHANGELOG.md): every release, with its pull request.
- [`llms.txt`](packages/ts-extended-errors/llms.txt): the API, a working example and the common
  mistakes, for a coding agent. It ships in the tarball.
- [Published versions](https://github.com/rxova/ts-extended-errors/pkgs/npm/ts-extended-errors) on
  GitHub Packages.

## Repository layout

A pnpm + Turborepo workspace.

```text
packages/
  ts-extended-errors/  the library, published as @rxova/ts-extended-errors
  config/              shared vitest and tsdown presets; the only home of the coverage thresholds
  tooling/             repo scripts: verify, pack-smoke, check-llms
.changeset/            release notes waiting for the next version
.github/               CI, the PR-title check, releases and Dependabot
```

The library builds dual ESM + CJS with tsdown and is checked with publint and attw. Across the
workspace: TypeScript 6 in strict mode, ESLint 10 with `strictTypeChecked`, Prettier, and Vitest 5
with 95% coverage required per file.

## Development

You need Node.js 22.13 or newer (`.nvmrc` pins 24) and pnpm 11, the exact version pinned in the
`packageManager` field of `package.json`.

```sh
pnpm install                                 # dependencies and git hooks
pnpm test                                    # unit tests, coverage enforced per file
pnpm --filter @rxova/ts-extended-errors test # the library alone
pnpm typecheck                               # tsc across the workspace
pnpm lint                                    # ESLint
pnpm format                                  # Prettier, writing
pnpm build                                   # the library's dist
pnpm run verify                              # everything CI runs, in the same order
pnpm run pack:smoke                          # pack, install and load the tarball with plain Node
pnpm run check:llms                          # llms.txt against the exports
pnpm changeset                               # record a change for the next release
```

### The gate

`pnpm run verify` is what the pre-push hook and CI both run, cheapest first, stopping at the first
failure. Turbo replays every package whose inputs did not change.

1. Dependency dedupe
2. Format
3. Lint
4. `llms.txt` against the exports
5. Typecheck
6. Unit tests, with coverage
7. Build
8. Package exports (publint and attw)

On top of it, CI lints the pull request's commits, audits dependencies, and packs, installs and
loads the tarball twice: on the Node.js in `.nvmrc`, and on the `engines` floor of the package.

### Git hooks

| Hook         | Runs                                                                   |
| ------------ | ---------------------------------------------------------------------- |
| `pre-commit` | ESLint and Prettier on the staged files, then typecheck and unit tests |
| `commit-msg` | commitlint                                                             |
| `pre-push`   | `pnpm run verify`, skipped for a push that only deletes refs           |

## Contributing

1. Branch from `main`.
2. Write [Conventional Commits](https://www.conventionalcommits.org). The allowed types are
   `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `rename`, `revert`, `style`
   and `test`, with no length limit. Pull requests are squash-merged, so the title becomes the
   commit on `main`, and CI lints it the same way.
3. Add a changeset (`pnpm changeset`) to any pull request that changes the library. Before 1.0, a
   breaking change is a minor.
4. A change to the public API ships in one pull request with its tests, its TSDoc, the package
   README section, the `llms.txt` API table and a changeset.
5. Run `pnpm run verify` before asking for review. Never skip a test or lower a coverage threshold
   to get it green.

[AGENTS.md](AGENTS.md) has the same rules, written for a coding agent working in this repository.

## Releases

1. Once CI passes on `main`, `release.yml` opens or updates a `chore: version packages` pull
   request with the version bump and the changelog, built from the pending changesets.
2. Merging it publishes `@rxova/ts-extended-errors` to GitHub Packages, then tags and creates the
   GitHub release.

The workflow publishes with its own `GITHUB_TOKEN`, so there is no secret to store, and runs only
while the repository variable `RELEASE_ENABLED` is `true`. CI normally runs on the version pull
request when it opens; if its checks ever stay pending, close and reopen it.

## Support

[Support](SUPPORT.md) · [Security policy](SECURITY.md) ·
[MIT license](packages/ts-extended-errors/LICENSE)

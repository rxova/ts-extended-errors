# ts-extended-errors

[![CI](https://github.com/rxova/ts-extended-errors/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/rxova/ts-extended-errors/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**A zero-dependency error model for TypeScript applications** that use native exceptions but need
typed context, cause-chain inspection, and reliable JSON round trips. This repository holds one
published package, [`ts-extended-errors`](packages/ts-extended-errors): a base class for custom
errors, a one-line class factory, helpers that search `cause` chains, and a serializer that rebuilds
the original classes. Node.js 20.19 or newer, browsers too, no runtime dependencies, ESM and CommonJS. MIT.

```ts
import { defineError, deserializeError, findCauseOf, serializeError } from 'ts-extended-errors'

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

```bash
npm install ts-extended-errors
```

## Documentation

- [Documentation site](https://rxova.org/packages/ts-extended-errors/): guides, the full reference
  and the design notes. Built from `apps/docs` and published as part of rxova.org.
- [Package README](packages/ts-extended-errors/README.md): an example for every export, and the
  options and types tables.
- [Changelog](packages/ts-extended-errors/CHANGELOG.md): every release, with its pull request.
- [`llms.txt`](packages/ts-extended-errors/llms.txt): the API, a working example and the common
  mistakes, for a coding agent. It ships in the tarball. The docs site serves
  [its own](https://rxova.org/packages/ts-extended-errors/llms.txt), plus an
  [llms-full.txt](https://rxova.org/packages/ts-extended-errors/llms-full.txt).
- [Published versions](https://www.npmjs.com/package/ts-extended-errors) on npm.

## Repository layout

A pnpm + Turborepo workspace.

```text
packages/
  ts-extended-errors/  the library, published as ts-extended-errors
  config/              shared vitest and tsdown presets; the only home of the coverage thresholds
  tooling/             repo scripts: verify, pack-smoke, check-llms, check-changeset
apps/
  docs/                the Astro + Starlight site, mounted on rxova.org
.changeset/            release notes waiting for the next version
.github/               CI, CodeQL, the docs dispatch, the PR-title check, releases and Dependabot
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
pnpm --filter ts-extended-errors test # the library alone
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

`pnpm run verify` is what the pre-push hook runs, cheapest first, stopping at the first failure.
Turbo replays every package whose inputs did not change.

1. Dependency dedupe
2. Format
3. Lint
4. `llms.txt` against the exports
5. Typecheck
6. Unit tests, with coverage
7. Build
8. Package exports (publint and attw)

CI runs the same checks as parallel jobs rather than calling the script, so a red check names what
broke. On top of them it lints the pull request's commits, asks for a changeset when the pull
request changes the library, audits dependencies, runs the unit suite on Node 22 and 24, and packs,
installs and loads the tarball twice: on the Node.js in `.nvmrc`, and on the `engines` floor of the
package. `codeql.yml` analyses the source weekly and on every pull request.

The docs site is built by `docs.yml` rather than by the gate, at the base path rxova.org mounts it
on — that build is the one whose output ships, and it validates every internal link, every `.md`
twin and the `llms.txt` size budgets.

### Git hooks

| Hook         | Runs                                                                   |
| ------------ | ---------------------------------------------------------------------- |
| `pre-commit` | ESLint and Prettier on the staged files, then typecheck and unit tests |
| `commit-msg` | commitlint                                                             |
| `pre-push`   | `pnpm run verify`, skipped for a push that only deletes refs           |

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) has the setup, the quality gates, the commit and changeset rules,
and what a public API change has to ship with. The short version:

1. Branch from `main`, and write [Conventional Commits](https://www.conventionalcommits.org).
   Pull requests are squash-merged, so the title becomes the commit on `main` and CI lints it the
   same way.
2. Add a changeset (`pnpm changeset`) to any pull request that changes the library; CI checks for
   one. Before 1.0, a breaking change is a minor.
3. A change to the public API ships in one pull request with its tests, its TSDoc, the package
   README section, the docs page and the `llms.txt` API table.
4. Run `pnpm run verify` before asking for review. Never skip a test or lower a coverage threshold
   to get it green.

[AGENTS.md](AGENTS.md) has the same rules, written for a coding agent working in this repository.

## Releases

1. Once CI passes on `main`, `release.yml` opens or updates a `chore: version packages` pull
   request with the version bump and the changelog, built from the pending changesets.
2. Merging it publishes `ts-extended-errors` to npm, then tags and creates the GitHub release.

The workflow publishes through npm trusted publishing (OIDC) with provenance, so there is no npm
token to store, and runs only while the repository variable `RELEASE_ENABLED` is `true`. CI starts on the version pull request
when it opens, but those runs can stop at `action_required`; if its checks stay pending, close and
reopen it.

## Support

[Contributing](CONTRIBUTING.md) · [Support](SUPPORT.md) · [Security policy](SECURITY.md) ·
[Code of conduct](CODE_OF_CONDUCT.md) · [MIT license](LICENSE)

# @rxova/ts-extended-errors

## 0.2.0

### Minor Changes

- [#8](https://github.com/rxova/ts-extended-errors/pull/8) [`06c11b0`](https://github.com/rxova/ts-extended-errors/commit/06c11b0f9d6092a02aea5fc97cd4eb5761873214) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - `serializeError` writes an `AggregateError`'s `errors`, each serialized like a `cause`, and
  `deserializeError` rebuilds them as an `AggregateError`. The new `maxAggregatedErrors` option
  (default 10) caps how many are kept across the whole output, and `errorsOmitted` counts the rest.

### Patch Changes

- [#8](https://github.com/rxova/ts-extended-errors/pull/8) [`50d0330`](https://github.com/rxova/ts-extended-errors/commit/50d0330d067081e507eabb3d41336f18db694531) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - `serializeError` copies `context` field by field through a JSON round trip instead of returning the
  error's own object. A later change to the error's context no longer changes a serialized copy, a
  redactor editing the output no longer edits the error, and a `BigInt` in `context` or in an own
  field is written as `'10n'` instead of making `JSON.stringify` throw.

## 0.1.0

### Minor Changes

- [#3](https://github.com/rxova/ts-extended-errors/pull/3) [`da0eab4`](https://github.com/rxova/ts-extended-errors/commit/da0eab45512aec436f9f2c3a2b3929c7932e9ea4) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - First release: `ExtendedError`, `defineError`, the cause-chain helpers, `serializeError`,
  `deserializeError` and `toError`. The package ships an `llms.txt` for coding agents.

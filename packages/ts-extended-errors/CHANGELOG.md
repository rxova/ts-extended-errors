# @rxova/ts-extended-errors

## 0.3.0

### Minor Changes

- [#15](https://github.com/rxova/ts-extended-errors/pull/15) [`a65757e`](https://github.com/rxova/ts-extended-errors/commit/a65757e6b13f8362b70afb9907e562dc4a4f019c) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - `defineError` takes a `message` option, `(context) => string`, that writes the message from the
  context: `new InvalidDateError({ context: { value } })`. The type of `context` comes from its
  parameter or from the type parameter, and is required when it has required fields. A class defined
  on one without its own `message` writes the message the same way. When `message` throws, the error
  is still created, with the class name as its message. A string first argument still sets the
  message, which is how `deserializeError` rebuilds these classes. Classes defined without `message`
  are unchanged.

## 0.2.1

### Patch Changes

- [#10](https://github.com/rxova/ts-extended-errors/pull/10) [`97a54de`](https://github.com/rxova/ts-extended-errors/commit/97a54decd4e9132c9b684a84c088987376ebe590) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Rewrite the repository README: what the library does with a short example, install, the workspace
  layout, development commands and hooks, contributing and releases.

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

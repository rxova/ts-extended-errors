# ts-extended-errors

## 0.4.4

### Patch Changes

- [#28](https://github.com/rxova/ts-extended-errors/pull/28) [`eda94cc`](https://github.com/rxova/ts-extended-errors/commit/eda94cc61704df8fb9fec7947bb015055b4962a0) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Treat getters, proxy traps and prototype checks that throw while inspecting an unknown value as
  unavailable metadata. Serialization, normalization, cause traversal, type guards and
  deserialization now keep handling the original failure; a value that refuses every form of
  inspection is described as `'<uninspectable object>'`. Exceptions from caller-provided predicates
  and error constructors still propagate.

## 0.4.3

### Patch Changes

- [#25](https://github.com/rxova/ts-extended-errors/pull/25) [`1472f5e`](https://github.com/rxova/ts-extended-errors/commit/1472f5ebcbf35f7719b56c97f47e74b25781b0d0) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Describe the package as a zero-dependency error model for TypeScript applications that use native
  exceptions but need typed context, cause-chain inspection, and reliable JSON round trips. Clarify
  how that model differs from typed return values and effect systems, and document the trust,
  redaction and class-name rules at a serialization boundary. The code does not change.

## 0.4.2

### Patch Changes

- [#23](https://github.com/rxova/ts-extended-errors/pull/23) [`78935d7`](https://github.com/rxova/ts-extended-errors/commit/78935d7f3c3fc975b77015cf4f24cda8f8db3bfa) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Describe the package as a zero-dependency error model for TypeScript applications that use native exceptions but need typed context, cause-chain inspection, and reliable JSON round trips. The npm description, README and `llms.txt` summary change; the code does not.

## 0.4.1

### Patch Changes

- [#21](https://github.com/rxova/ts-extended-errors/pull/21) [`1b358cf`](https://github.com/rxova/ts-extended-errors/commit/1b358cff0e02f4c16b89cc32d9c14c6e2d64203e) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Publish to npm as `ts-extended-errors`, in place of `@rxova/ts-extended-errors` on GitHub Packages.
  
  Install with `npm install ts-extended-errors`; no `.npmrc` scope line or GitHub token is needed. Every
  earlier version, 0.1.0 to 0.4.0, is on npm under the new name with the same code. A project on the
  old name changes the dependency and its imports from `@rxova/ts-extended-errors` to
  `ts-extended-errors`; nothing else about the API changes. Releases now publish from CI through npm
  trusted publishing, with provenance.

## 0.4.0

### Minor Changes

- [#19](https://github.com/rxova/ts-extended-errors/pull/19) [`1c3cd65`](https://github.com/rxova/ts-extended-errors/commit/1c3cd65c91a2aedd56f766e74a7f3d6c6d36e2c0) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Type `context` as present on the instances of a class defined with `message`, when the throw site has
  to pass one. Fixes [#17](https://github.com/rxova/ts-extended-errors/issues/17).
  
  `message` makes `context` a required constructor argument as soon as its type has a required field,
  but the instance type stayed `Context | undefined` — so every read went through a `?.` and a `??`
  for a branch that cannot be taken, and the workaround was a hand-written class holding the value as
  its own field, which is the boilerplate `message` exists to remove.
  
  ```ts
  const CorruptRecordError = defineError('CorruptRecordError', {
    message: ({ key }: { key: string }) => `unreadable record: ${key}`,
  })
  
  const found = findCauseOf(error, CorruptRecordError)
  found?.context.key // string — was `'context' is possibly 'undefined'`
  ```
  
  The narrowing uses the same condition the constructor already uses to decide whether `context` is
  required, so a class whose context has no required fields is unchanged: there the options argument
  really is optional and an instance really can have none.
  
  The `(message, options)` constructor is the one path that could otherwise build an instance without
  a context, and `deserializeError` rebuilds through it. It cannot require the argument without the
  class ceasing to be an `ErrorClass` — which is what lets it be passed in `classes` and be another
  class's `base` — so it now defaults `context` to `{}`. A payload carrying no `context` therefore
  rebuilds as `context: {}` rather than `undefined`, and `error.context.key` reads `undefined` instead
  of throwing.

### Patch Changes

- [#18](https://github.com/rxova/ts-extended-errors/pull/18) [`540e69f`](https://github.com/rxova/ts-extended-errors/commit/540e69fcecfa1cf3263248ce365db9eee1fecdff) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Point the tarball's `llms.txt` and README at the documentation site.
  
  The package now has docs at https://rxova.org/packages/ts-extended-errors/, built from `apps/docs` in
  this repository. Both files ship inside the tarball, so an agent that installed the package and read
  `node_modules/@rxova/ts-extended-errors/llms.txt` had no way to find them.
  
  `llms.txt` gains the site, its `llms.txt` index and its `llms-full.txt`; the README's "For coding
  agents" section says the same for a reader. Nothing about the API or the published files changes.

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

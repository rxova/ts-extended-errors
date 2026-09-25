# ts-extended-errors

## 1.0.0

### Major Changes

- [#37](https://github.com/rxova/ts-extended-errors/pull/37) [`aa60b07`](https://github.com/rxova/ts-extended-errors/commit/aa60b07d091aebebb73dd4e50de73faeb63d21ed) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Require Node.js 22.12 or newer. Node 20 reached end of life in April 2026, and a major release is
  the one moment the floor can move without surprising anyone. The code uses no Node.js APIs, so
  browsers and other runtimes are unaffected; the build now uses the workspace's Node 22 target.

- [#37](https://github.com/rxova/ts-extended-errors/pull/37) [`1a1eef0`](https://github.com/rxova/ts-extended-errors/commit/1a1eef0dc4a3b8e0b1b371da1e951993c65b514d) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Version 1.0.0. The API that shipped through the 0.x releases is now stable: `ExtendedError`,
  `defineError`, the five cause-chain helpers, `serializeError`, `deserializeError`, `toError`,
  `isErrorLike`, `describeValue` and the exported types. From here, a breaking change to any of them,
  to the serialized shape, or to the defaults of `toJSON` and `serializeError` means a new major.
  
  What 1.0 settles on purpose: `JSON.stringify(error)` includes `stack` by default and is meant for
  logs, with `includeStack: false` for anything client-facing; a thrown value that is not an error
  serializes under `name: typeof value`; and cause chains are linear, following `cause` and never an
  `AggregateError`'s `errors`.

### Minor Changes

- [#37](https://github.com/rxova/ts-extended-errors/pull/37) [`9b8d427`](https://github.com/rxova/ts-extended-errors/commit/9b8d427ad9973467f4087a072dd1aadea6300730) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Accept any object type as a `context` type, an `interface` included. The `Context` type parameters of
  `ExtendedError`, `defineError` and the exported constructor types were constrained to
  `Readonly<Record<string, unknown>>`, which an `interface` fails for lack of an index signature, so
  `defineError<UserContext>(…)` was a type error whenever `UserContext` was declared with `interface`.
  The constraint is now `object`; `ErrorContext` stays the default.

- [#37](https://github.com/rxova/ts-extended-errors/pull/37) [`5e77158`](https://github.com/rxova/ts-extended-errors/commit/5e771582f13136c3071ffc77d7afa56ce18da0ab) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Type `code` as the literal a class declares. `defineError('NotFoundError', { code: 'HTTP_NOT_FOUND' })`
  now types `code` as `'HTTP_NOT_FOUND'` on the class and on its instances, and a class defined without
  one is typed with its base's, so a `switch` over a taxonomy's codes can be exhaustive and a
  `findCause` predicate can narrow on one. `ExtendedErrorConstructor`, `MessageErrorConstructor` and
  `DefineErrorOptions` gain a `Code` type parameter after their existing ones, and `ErrorCode`, its
  constraint, is exported.
  
  Two consequences. Naming `Context` as a type argument leaves `code` at `string | undefined`, because
  TypeScript infers all of a call's type arguments or none; name `Code` as well,
  `defineError<Context, 'X'>(…)`, to keep the literal. And a class-syntax subclass of a `defineError`
  class can no longer declare a different static `code`, since its instance type already carries the
  base's literal; define the leaf with `defineError` and extend that.

- [#37](https://github.com/rxova/ts-extended-errors/pull/37) [`51303b3`](https://github.com/rxova/ts-extended-errors/commit/51303b32d6faad761ee5ba2ee3b343249c8a42fc) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Keep a numeric `code` through `serializeError` and `deserializeError`. A `DOMException` and many
  driver errors carry a number there, and it was dropped, even under `includeOwnProperties`, because
  `code` is a fixed field read only as a string. `SerializedError.code` is now `string | number`; a
  code that is neither a string nor a finite number is still left out. An `ExtendedError`'s own `code`
  stays a string.

### Patch Changes

- [#37](https://github.com/rxova/ts-extended-errors/pull/37) [`8b0633f`](https://github.com/rxova/ts-extended-errors/commit/8b0633f383fc17f461151dd8ba7a40d8a846b76b) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - `describeValue` names a function, `'[Function: loadUser]'`, instead of printing its source, and
  describes an object whose JSON is `{}` by its string tag when that says more: `'[object Map]'`
  rather than `'{}'` for a `Map`, a `Set` or a `RegExp`. `toError` and `serializeError` use it for a
  thrown value that is not an error, so those messages change the same way.

- [#37](https://github.com/rxova/ts-extended-errors/pull/37) [`6f75bde`](https://github.com/rxova/ts-extended-errors/commit/6f75bdeb19f6dc3a62c4ed5876cbe7203a7bfc12) Thanks [@jonatankruszewski](https://github.com/jonatankruszewski)! - Define `code` and `context` on an instance only when there is a value. Both were own enumerable
  properties on every instance, so Node's `console.log(error)` printed
  `code: undefined, context: undefined` after the stack of every error that had neither. Reading an
  absent one still gives `undefined`; `Object.keys(error)` no longer lists it.

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

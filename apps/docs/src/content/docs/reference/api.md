---
title: API reference
description: Every export of ts-extended-errors, with its signature and behaviour — classes, the factory, the chain helpers, and the serialization pair.
---

Everything below is exported from the package root. There are no subpath exports other than
`./package.json`.

```ts
import {
  ExtendedError,
  isExtendedError,
  defineError,
  causeChain,
  rootCause,
  findCause,
  findCauseOf,
  hasCauseOf,
  serializeError,
  deserializeError,
  toError,
  isErrorLike,
  describeValue,
} from 'ts-extended-errors'
```

## Exports

| Export             | Kind     | What it does                                                          |
| ------------------ | -------- | --------------------------------------------------------------------- |
| `ExtendedError`    | class    | Base class: `name`, `code`, `context`, `cause`, `stack`, `toJSON()`   |
| `isExtendedError`  | function | `value instanceof ExtendedError`, as a type guard                     |
| `defineError`      | function | Returns a new error class                                             |
| `causeChain`       | function | `[error, error.cause, …]`, outermost first                            |
| `rootCause`        | function | The last value in the chain                                           |
| `findCause`        | function | The first value in the chain a predicate accepts                      |
| `findCauseOf`      | function | The first instance of a class in the chain, typed as that class       |
| `hasCauseOf`       | function | Whether the chain contains an instance of a class                     |
| `serializeError`   | function | A JSON-safe object for any thrown value                               |
| `deserializeError` | function | Rebuilds `serializeError` output as instances of the original classes |
| `toError`          | function | An `Error` for any value; errors are returned unchanged               |
| `isErrorLike`      | function | Whether a value is an object with a string `message`                  |
| `describeValue`    | function | A one-line string for any value                                       |

The exported types are listed separately in [Types](./types.md).

## `ExtendedError`

```ts
class ExtendedError<Context extends ErrorContext = ErrorContext> extends Error {
  static readonly code: string | undefined
  constructor(message: string, options?: ExtendedErrorOptions<Context>)
}
```

| Option    | Type      | Sets                                            |
| --------- | --------- | ----------------------------------------------- |
| `cause`   | `unknown` | `error.cause`, the native `Error` cause         |
| `context` | `Context` | `error.context`, typed by the class's `Context` |

| Member     | Value                                                                                |
| ---------- | ------------------------------------------------------------------------------------ |
| `name`     | The name of the class that was constructed                                           |
| `code`     | The constructed class's static `code`, or `undefined`. An own property only when set |
| `context`  | `options.context`, or `undefined`. An own property only when set                     |
| `cause`    | `options.cause`. The property exists only when a cause was passed                    |
| `stack`    | Starts at the line that created the error, not inside the constructor                |
| `toJSON()` | `serializeError(this)`, so `JSON.stringify(error)` includes every field              |

Declare `code` as a `static override readonly` field in a subclass. See
[Subclassing `Error`](../under-the-hood/subclassing.md) for what the constructor does and why.

## `isExtendedError(value)`

```ts
function isExtendedError(value: unknown): value is ExtendedError
```

`instanceof`, so it is false across two copies of the package in one process, and false for a class
built on a base that is not an `ExtendedError`.

## `defineError(name, options?)`

```ts
function defineError<Context extends ErrorContext = ErrorContext>(
  name: string,
  options?: DefineErrorOptions<Context>,
): ExtendedErrorConstructor<Context>
```

| Option    | Type                           | Effect                                                              |
| --------- | ------------------------------ | ------------------------------------------------------------------- |
| `code`    | `string`                       | The class's `code`. Omitted, it inherits the base's                 |
| `base`    | an error class                 | The class to extend. Defaults to `ExtendedError`                    |
| `message` | `(context: Context) => string` | Writes the message from context; the throw site passes only options |

Four overloads cover the combinations: with and without `message`, on an `ExtendedError` base and on
any other error class. With `message`, the returned class is a
[`MessageErrorConstructor`](./types.md#messageerrorconstructor) — `new Class({ context })`, and
still `new Class(message, options)` when a string comes first.

Each call returns a new class. Call it at module scope, once per class.

See [Defining errors](../guides/defining-errors.md) for worked examples of each shape.

## Cause chain

```ts
function causeChain(error: unknown): unknown[]
function rootCause(error: unknown): unknown
function findCause<T>(
  error: unknown,
  predicate: (candidate: unknown) => candidate is T,
): T | undefined
function findCause(error: unknown, predicate: (candidate: unknown) => boolean): unknown
function findCauseOf<T>(
  error: unknown,
  constructor: abstract new (...args: never[]) => T,
): T | undefined
function hasCauseOf(
  error: unknown,
  constructor: abstract new (...args: never[]) => unknown,
): boolean
```

`causeChain` yields `error` first, stops at a primitive, and stops on a value already in the chain,
so a cycle terminates. Everything else is built on it. See
[Cause chains](../guides/cause-chains.md).

## `serializeError(value, options?)`

```ts
function serializeError(
  value: unknown,
  options: SerializeErrorOptions & { includeOwnProperties: true },
): SerializedErrorWithProperties
function serializeError(value: unknown, options?: SerializeErrorOptions): SerializedError
```

| Option                 | Type      | Default | Effect                                                  |
| ---------------------- | --------- | ------- | ------------------------------------------------------- |
| `includeStack`         | `boolean` | `true`  | Include `stack`                                         |
| `maxDepth`             | `number`  | `8`     | How far down the `cause` chain to walk                  |
| `maxAggregatedErrors`  | `number`  | `10`    | `AggregateError` `errors` kept, across the whole output |
| `includeOwnProperties` | `boolean` | `false` | Also copy the error's own enumerable fields             |

Accepts any value. A non-error is returned as `{ name: typeof value, message: describeValue(value) }`.
`context` is copied through a JSON round trip. See [Serialization](../guides/serialization.md).

## `deserializeError(value, options?)`

```ts
function deserializeError(value: unknown, options?: DeserializeErrorOptions): Error
```

| Option     | Type                    | Default | Effect                                         |
| ---------- | ----------------------- | ------- | ---------------------------------------------- |
| `classes`  | `readonly ErrorClass[]` | `[]`    | Classes to rebuild by name, plus the built-ins |
| `maxDepth` | `number`                | `8`     | How far down the chain to rebuild              |

A real `Error` is returned untouched; a value that is not error-shaped goes through `toError`. An
unmatched name becomes an `ExtendedError` keeping that name.

## `toError(value)`

```ts
function toError(value: unknown): Error
```

## `isErrorLike(value)`

```ts
function isErrorLike(value: unknown): value is Error
```

## `describeValue(value)`

```ts
function describeValue(value: unknown): string
```

All three are covered in [Working with unknown values](../guides/unknown-values.md).

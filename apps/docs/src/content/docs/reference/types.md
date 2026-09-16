---
title: Types
description: The exported TypeScript types — context, options, the serialized shape, and the constructor interfaces defineError returns.
---

Type-only exports, all from the package root.

```ts
import type {
  ErrorContext,
  ExtendedErrorOptions,
  SerializedError,
  SerializedErrorWithProperties,
  SerializeErrorOptions,
  DeserializeErrorOptions,
  DefineErrorOptions,
  ExtendedErrorConstructor,
  MessageErrorConstructor,
  ExtendedErrorMembers,
  ErrorClass,
} from '@rxova/ts-extended-errors'
```

## `ErrorContext`

```ts
type ErrorContext = Readonly<Record<string, unknown>>
```

The constraint on every `Context` type parameter. Keep what you put in it serializable —
`serializeError` copies it through a JSON round trip, so a `Date` arrives as a string and a `Map` as
`{}`.

## `ExtendedErrorOptions`

```ts
interface ExtendedErrorOptions<Context extends ErrorContext = ErrorContext> {
  readonly cause?: unknown
  readonly context?: Context
}
```

The second argument of every error constructor here.

## `SerializedError`

```ts
interface SerializedError {
  readonly name: string
  readonly message: string
  readonly code?: string | undefined
  readonly stack?: string | undefined
  readonly context?: ErrorContext | undefined
  readonly cause?: SerializedError | undefined
  readonly errors?: readonly SerializedError[] | undefined
  readonly errorsOmitted?: number | undefined
}
```

What `serializeError` returns, and what `JSON.stringify` produces for any error in this package.
`code` and `context` appear only when the error carries them; `stack` is omitted under
`includeStack: false`; `errors` and `errorsOmitted` appear only for an `AggregateError`.

## `SerializedErrorWithProperties`

```ts
interface SerializedErrorWithProperties extends SerializedError {
  readonly cause?: SerializedErrorWithProperties | undefined
  readonly errors?: readonly SerializedErrorWithProperties[] | undefined
  readonly [field: string]: unknown
}
```

What `serializeError` returns with `includeOwnProperties: true`: the fixed fields plus an index
signature for whatever else the error carried, down the whole chain.

## `SerializeErrorOptions` and `DeserializeErrorOptions`

The option bags of the two functions. Their fields are tabulated in the
[API reference](./api.md#serializeerrorvalue-options).

## `DefineErrorOptions`

```ts
interface DefineErrorOptions<Context extends ErrorContext = ErrorContext> {
  readonly code?: string
  readonly base?: ExtendedErrorConstructor<Context>
}
```

The options of `defineError` in its plain form. The overloads that take a `message`, or a `base`
that is not an `ExtendedError`, declare their own object types inline.

## `ExtendedErrorConstructor`

```ts
interface ExtendedErrorConstructor<
  Context extends ErrorContext = ErrorContext,
  Instance extends Error = ExtendedError<Context>,
> {
  new (message: string, options?: ExtendedErrorOptions<Context>): Instance
  readonly prototype: Instance
  readonly code: string | undefined
}
```

The class `defineError` returns.

## `MessageErrorConstructor`

```ts
interface MessageErrorConstructor<
  Context extends ErrorContext = ErrorContext,
  Instance extends Error = ExtendedError<Context>,
> {
  new (
    ...options: Partial<Context> extends Context
      ? [options?: ExtendedErrorOptions<Context>]
      : [options: ExtendedErrorOptions<Context> & { readonly context: Context }]
  ): Instance
  new (message: string, options?: ExtendedErrorOptions<Context>): Instance
  readonly prototype: Instance
  readonly code: string | undefined
}
```

The class `defineError` returns when given a `message`. The conditional tuple is what makes
`context` required when its type has required fields and the whole argument optional when it does
not. The second signature keeps the class an `ErrorClass`, which is what lets `deserializeError`
rebuild it and what lets it be the `base` of another class.

## `ExtendedErrorMembers`

```ts
interface ExtendedErrorMembers<Context extends ErrorContext = ErrorContext> {
  readonly name: string
  readonly code: string | undefined
  readonly context: Context | undefined
  toJSON(): SerializedError
}
```

What every class `defineError` returns adds to its instances, whatever it extends. It is what makes
the return type of a non-`ExtendedError` base readable: `RangeError & ExtendedErrorMembers<Context>`.

## `ErrorClass`

```ts
type ErrorClass<Instance extends Error = Error> = new (
  message: string,
  options?: ErrorOptions,
) => Instance
```

Any error class whose constructor takes `(message, options)` the way the built-ins do. It is the
type of `base` on the non-`ExtendedError` overloads, and of the entries in `deserializeError`'s
`classes`.

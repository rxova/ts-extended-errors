---
title: Working with unknown values
description: A catch binding is unknown and JavaScript permits throwing anything — toError, isErrorLike, isExtendedError and describeValue are the four narrowings.
---

```ts
try {
  await run()
} catch (thrown) {
  // `thrown` is `unknown`. It may be an Error. It may be a string, a plain
  // object, `null`, or a rejected promise's value from a library you do not
  // control.
}
```

Every function in this package accepts `unknown` for that reason. These four are the ones whose
whole job is dealing with it.

## `toError(value)`

Returns a real `Error` for any value.

```ts
import { toError } from 'ts-extended-errors'

logger.error(toError(thrown))
```

Errors pass through unchanged — wrapping one would bury the stack that says where it came from.

A value that is error-shaped but not an `Error` — from another realm, or through `structuredClone`
or a JSON round trip — is rebuilt as an `ExtendedError` keeping the original's `name` and `stack`,
with the original as its `cause`, since it may carry fields this package knows nothing about.

Anything else becomes an `ExtendedError` whose message is `describeValue(value)`, again with the
original as its `cause`. `throw 'nope'` reaches your logger as `Error: nope` rather than vanishing.
If a getter or proxy trap throws while the value is inspected, that metadata is treated as
unavailable. Even a revoked proxy becomes an `Error` instead of replacing the original failure with
the inspection exception.

## `isErrorLike(value)`

True for anything with a string `message` — the deliberately loose check, which is what recognises
an error that has crossed a realm or a clone boundary and so fails `instanceof Error`.

```ts
if (isErrorLike(payload)) {
  // payload.message is a string
}
```

Loose enough that `{ message: 'Not found', status: 404 }` passes. That is the intended behaviour for
deciding whether something is worth serializing as an error; it is not a security check. A value
whose `message` getter or proxy trap throws returns `false`.

## `isExtendedError(value)`

The strict counterpart: `value instanceof ExtendedError`, typed as a type guard.

```ts
if (isExtendedError(thrown)) {
  thrown.code // string | undefined
  thrown.context // ErrorContext | undefined
}
```

It is false for an instance produced by a second copy of this package in the same process. That is
the honest answer — two copies are two distinct classes — and `serializeError` is the path that
tolerates it.

Note that a class built with a non-`ExtendedError` `base` is also false here, even though it carries
the same members. See [Defining errors](./defining-errors.md#other-bases).

## `describeValue(value)`

A one-line string for any value, for when you need a message rather than an error.

```ts
describeValue('nope') // 'nope'
describeValue(404) // '404'
describeValue(10n) // '10n'
describeValue({ a: 1 }) // '{"a":1}'
describeValue(new Map([[1, 2]])) // '[object Map]'
describeValue(function loadUser() {}) // '[Function: loadUser]'
describeValue(undefined) // 'undefined'
```

A value JSON cannot write — a cycle, a `toJSON` that throws — is described by its string tag
(`'[object Object]'`) rather than costing you the throw. So is one JSON would write as `{}` while
the tag says it is a `Map`, a `Set` or a `RegExp`. If the value refuses string-tag inspection too,
the fallback is `'<uninspectable object>'`. A function is named, `'[Function: loadUser]'`, rather
than printed as source.

## A complete handler

```ts
import { findCauseOf, toError } from 'ts-extended-errors'
import { NotFoundError, RateLimitedError } from './errors.js'

export function handle(thrown: unknown) {
  const limited = findCauseOf(thrown, RateLimitedError)
  if (limited) return respond(429, { retryAfterMs: limited.context?.retryAfterMs })

  const notFound = findCauseOf(thrown, NotFoundError)
  if (notFound) return respond(404, { id: notFound.context?.id })

  logger.error(toError(thrown))
  return respond(500)
}
```

No `instanceof` on the raw binding, no `thrown.message` read off an `unknown`, and a string throw
from three dependencies down still reaches the logger as an `Error`.

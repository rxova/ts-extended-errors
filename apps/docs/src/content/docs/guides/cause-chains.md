---
title: Cause chains
description: Wrapping an error instead of replacing it, and the five helpers that search the resulting chain — causeChain, rootCause, findCause, findCauseOf and hasCauseOf.
---

A failure rarely reaches its handler in the form it happened. A socket times out, the HTTP client
wraps it, the repository wraps that, and the route handler sees something three layers away from the
cause. `cause` is the standard place to keep the original, and these helpers are for reading back
down it.

## Wrap, do not replace

```ts
try {
  return await fetchUser(id)
} catch (cause) {
  throw new ProfileError('loading the profile failed', { cause })
}
```

`cause` is forwarded to the native `Error` cause, so anything that already understands it — Node's
inspector, most loggers, the browser console — sees it without knowing about this package.

The property is defined only when a cause was actually passed. That matters: `'cause' in error` is
the check a chain walker uses to decide where to stop, and `super(message, { cause: undefined })`
would define it anyway.

## The mistake this section exists for

```ts
catch (thrown) {
  if (thrown instanceof TimeoutError) { /* never runs */ }
}
```

`thrown` is the outermost wrapper. The `TimeoutError` is two levels down. `findCauseOf` is the
version of that check that looks at the whole chain:

```ts
const timeout = findCauseOf(thrown, TimeoutError)
if (timeout) return retryLater(timeout.context)
```

## The helpers

All five take `unknown`. `cause` is `unknown` by specification — nothing stops code from throwing
`{ cause: 'timeout' }` — and a walker that assumed otherwise would throw while you were trying to
report a failure.

### `findCauseOf(error, Class)`

The first value in the chain that is an instance of `Class`, typed as that class, or `undefined`.
This is the one you reach for in a `catch`.

```ts
findCauseOf(error, NotFoundError)?.context // typed as the class's context
```

### `hasCauseOf(error, Class)`

The same question when you only need the boolean.

```ts
if (hasCauseOf(error, TimeoutError)) return respond(504)
```

### `findCause(error, predicate)`

For a condition that is not "is an instance of". Pass a type guard and the result is narrowed to it.

```ts
const withStatus = findCause(
  error,
  (candidate): candidate is { status: number } =>
    typeof candidate === 'object' && candidate !== null && 'status' in candidate,
)
```

### `rootCause(error)`

The deepest value in the chain — the original failure. Returns `error` itself when there is no
cause, so it is safe to call unconditionally.

```ts
logger.error({ reported: toError(error), root: rootCause(error) })
```

### `causeChain(error)`

The whole chain as an array, outermost first. An error with no cause yields a one-element array. Use
it when you want to render the sequence rather than search it.

```ts
causeChain(error)
  .map((link) => toError(link).message)
  .join(' ← ')
```

## Cycles and non-errors

`causeChain` stops when it meets a value already on the chain, so `a.cause = b; b.cause = a` yields
`[a, b]` rather than looping. It also stops at a primitive, which cannot carry a cause of its own.
Every other helper is built on it, so all of them inherit that.

The chain may contain values that are not errors. `causeChain` returns them as `unknown`;
`findCauseOf` simply will not match them; and [`toError`](./unknown-values.md) turns any one of them
into a real `Error` when you need to log it.

## Across a serialization boundary

Causes survive the JSON round trip. `serializeError` walks the chain to a depth limit, and
`deserializeError` rebuilds it, so `findCauseOf` works on the receiving end exactly as it did on the
sending one — provided the classes you want back are passed in `classes`. See
[Serialization](./serialization.md).

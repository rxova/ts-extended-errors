---
title: Serialization
description: serializeError and deserializeError — the JSON round trip that rebuilds the original classes, its options, and what to include in a log versus a response.
---

An error that crosses a boundary stops being an error. `JSON.stringify` on a plain `Error` produces
`{}`; a `postMessage` gives you a structured clone with no class; a job queue stores text. These two
functions are the round trip.

## Out: `serializeError`

```ts
import { serializeError } from 'ts-extended-errors'

const payload = serializeError(error, { includeStack: false })
```

The result is a plain object, safe to hand to `JSON.stringify`:

```json
{
  "name": "HttpError",
  "message": "loading the profile failed",
  "code": "HTTP",
  "cause": {
    "name": "NotFoundError",
    "message": "no such user",
    "code": "HTTP_NOT_FOUND",
    "context": { "userId": 42 }
  }
}
```

It takes `unknown`, not `Error`. Anything error-shaped — including an error from a worker or a
second bundled copy of a library, where `instanceof Error` is false — is walked the same way, and a
value that is not an error is described rather than dropped, because `throw 'nope'` is rare but real
and a serializer that returns `{}` for it is how an incident becomes unreadable.

`context` is _copied_, not referenced, through a JSON round trip taken there and then. The result
shares nothing with the error, so a redactor can edit one without touching the other and
`JSON.stringify` cannot throw on it later. The cost is that a `Date` in `context` becomes a string
and a `Map` becomes `{}`.

`JSON.stringify(error)` already calls this, because every class here defines `toJSON`. Call
`serializeError` directly when you need the options.

### Options

| Option                 | Default | What it does                                                                |
| ---------------------- | ------- | --------------------------------------------------------------------------- |
| `includeStack`         | `true`  | Include `stack`. Turn it off for anything a client will see                 |
| `maxDepth`             | `8`     | How far down the `cause` chain to walk                                      |
| `maxAggregatedErrors`  | `10`    | How many of an `AggregateError`'s `errors` to keep, across the whole output |
| `includeOwnProperties` | `false` | Also copy the error's own enumerable fields                                 |

### What to include where

```ts
logger.error(serializeError(error)) // your own logs: stacks are the point
response.json(serializeError(error, { includeStack: false })) // a client: they are not
```

`includeStack` defaults to `true` because a log line is the common case and a stackless log is
useless. The response path is the one that has to say otherwise.

JSON-safe does not mean safe to send to a client. `serializeError` does not redact the fixed fields:
`message`, `code` and `context` are written as given, and a stack normally repeats the message in
its first line. Build a public response from fields you intend to expose instead of treating the
serializer as an allowlist.

`includeOwnProperties` copies whatever else the error class assigned — a `statusCode`, a `request`,
a `user`. What is in those fields is up to whoever threw, so this is for a log you control, not for
a response body. Errors held in such fields are serialized like a `cause`, under the same depth
limit; anything else goes through the same JSON round trip as `context`; functions, `undefined` and
fields whose getter throws are skipped; and the fixed fields are never overwritten.

## Back: `deserializeError`

```ts
import { deserializeError } from 'ts-extended-errors'
import { HttpError, NotFoundError } from './errors.js'

const error = deserializeError(JSON.parse(line), { classes: [HttpError, NotFoundError] })

error instanceof HttpError // true
findCauseOf(error, NotFoundError)?.context // { userId: 42 }
```

The class is chosen by the payload's `name`, looked up among the built-in error classes and whatever
is passed in `classes`; a class of your own wins over a built-in of the same name. Then the
serialized fields are put back — `name`, `code`, `context`, `stack`, and any own properties the
payload carried — and the cause chain is rebuilt the same way.

**`classes` is not optional in practice.** Without it, a payload named `NotFoundError` comes back as
an `ExtendedError` that keeps the name, so it still reads correctly in a log but
`instanceof NotFoundError` is false. List every class the payload is expected to contain.

Class names are protocol keys. Keep custom names stable and unique within `classes` unless one is
deliberately replacing a built-in; when two entries have the same name, the later one wins.

With no serialized stack the result has none, rather than one pointing at `deserializeError` instead
of at the failure. A real `Error` passes through untouched, and a value that is not error-shaped
goes through [`toError`](./unknown-values.md).

| Option     | Default | What it does                                                     |
| ---------- | ------- | ---------------------------------------------------------------- |
| `classes`  | `[]`    | Classes to rebuild by name, in addition to the built-ins         |
| `maxDepth` | `8`     | How far down the chain to rebuild; below it, causes stay as sent |

### Trust

`deserializeError` constructs a class because the payload said to. Only list classes in `classes`
that you are willing to have constructed from that input, and treat a payload from outside your
system as the untrusted data it is — the same care you would give `JSON.parse` output that decides
control flow. The payload's `code`, `context` and other restored fields are not validated.

## Limits

`maxDepth` bounds the chain, and `maxAggregatedErrors` bounds the width of an `AggregateError`'s
`errors` across the whole output — `Promise.any` over a thousand requests rejects with a thousand
errors, each with a chain of its own. Errors cut by that budget are counted in `errorsOmitted`, and
that count survives a further round trip, so a log line says how much is missing rather than
silently claiming that was all of it.

Both are described in more detail, along with the cycle handling, in
[Limits and trust](../under-the-hood/limits.md).

## A worked round trip

```ts
// producer.ts
import { serializeError } from 'ts-extended-errors'

await queue.push(JSON.stringify({ jobId, error: serializeError(cause) }))
```

```ts
// consumer.ts
import { deserializeError, findCauseOf } from 'ts-extended-errors'
import { RateLimitedError } from './errors.js'

const { jobId, error: payload } = JSON.parse(message) as { jobId: string; error: unknown }
const error = deserializeError(payload, { classes: [RateLimitedError] })

const limited = findCauseOf(error, RateLimitedError)
if (limited) return retry(jobId, limited.context?.retryAfterMs ?? 1_000)

await deadLetter(jobId, error)
```

The consumer branches on a class, with typed context, on an error that was created in a different
process.

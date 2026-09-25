---
title: Defining errors
description: defineError and ExtendedError — codes, taxonomies built with base, messages generated from context, and which of the two to reach for.
---

There are two ways to declare an error class. `defineError` is a function call and covers most
cases; `class … extends ExtendedError` is for when the class needs members of its own.

## `defineError`

```ts
import { defineError } from 'ts-extended-errors'

const TimeoutError = defineError('TimeoutError', { code: 'TIMEOUT' })

const error = new TimeoutError('the upstream did not answer')
error.name // 'TimeoutError'
error.code // 'TIMEOUT'
error instanceof TimeoutError // true
error instanceof Error // true
```

The class it returns is a real class — `instanceof` works, it can be subclassed, and the stack is
captured at the throw site. What it saves you is the boilerplate, which is exactly the boilerplate
people skip.

Call it once per class, at module scope, and export the result. Each call returns a _new_ class, so
a `defineError` inside a function produces a class per invocation and `instanceof` against any other
call is false.

## `code`

A short, stable string shared by every instance of the class. It is what callers branch on, because
`message` is prose and will be reworded.

It is declared once on the class rather than at each throw site, and copied onto every instance so
it survives serialization. A class with no `code` of its own inherits its base's — which is usually
right for a leaf that callers handle by `instanceof`.

## `context`

Structured data about this particular failure. Type it with the first type parameter, or let it be
inferred from a `message` function (below). Any object type is accepted, an `interface` as readily
as a type literal.

```ts
const RateLimitedError = defineError<{ retryAfterMs: number }>('RateLimitedError', {
  code: 'RATE_LIMITED',
})

throw new RateLimitedError('slow down', { context: { retryAfterMs: 2_000 } })
```

Keep it serializable. `serializeError` copies `context` through a JSON round trip, so a `Date`
arrives as a string and a `Map` as `{}`.

## Taxonomies with `base`

`base` sets the class to extend. This is what makes one `catch` keep working as the set of leaves
grows:

```ts
const HttpError = defineError('HttpError', { code: 'HTTP' })

const NotFoundError = defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })
const ForbiddenError = defineError('ForbiddenError', { base: HttpError, code: 'HTTP_FORBIDDEN' })

new NotFoundError('no such user') instanceof HttpError // true
```

A handler written against `HttpError` catches the fifth subclass you add without being touched.

## Messages written from context

Repeating the same sentence at every throw site is how messages drift apart. Give the class a
`message` function instead, and the throw site passes only the context:

```ts
const InvalidDateError = defineError('InvalidDateError', {
  code: 'INVALID_DATE',
  message: (context: { value: string }) => `"${context.value}" is not a valid date`,
})

const error = new InvalidDateError({ context: { value: '2026-02-30' } })
error.message // '"2026-02-30" is not a valid date'
```

The type of `context` comes from the parameter of `message`, so you do not write it twice. `context`
is required at the call site when its type has required fields, and the options argument is optional
when it does not.

Where it is required, the instance's `context` is typed as present rather than `Context | undefined`,
so a caller reads a field off it directly:

```ts
const found = findCauseOf(thrown, InvalidDateError)
found?.context.value // string — one `?.` for "was it found", and none for the context
```

Such a class still accepts `(message, options)` when a string is passed first. That is what keeps it
usable as a `base`, and what lets `deserializeError` rebuild it with the message that was actually
sent rather than reformatting one from context that has been through JSON. That constructor cannot
require a context without the class ceasing to be an `ErrorClass`, so it defaults one to `{}` — which
is what keeps the instance type honest when a payload arrives carrying no `context` at all.

If `message` throws, the error is still created — with the class name as its message and `context`
intact. A formatter runs on data nobody has checked, usually inside a `catch` that is already
handling a failure, and losing the original error to a `TypeError` from the formatter is the worst
possible outcome there.

## Other bases

`base` also accepts a built-in error class, or any class whose constructor takes
`(message, options)`:

```ts
const OutOfRangeError = defineError('OutOfRangeError', {
  base: RangeError,
  code: 'OUT_OF_RANGE',
})

const error = new OutOfRangeError('page 0 does not exist')
error instanceof RangeError // true
error instanceof ExtendedError // false — a class has one parent
error.code // 'OUT_OF_RANGE'
error.context // undefined, but typed and settable
```

Instances get everything an `ExtendedError` has — name, `code`, `context`, `cause`, a trimmed stack,
`toJSON` — but not `ExtendedError` itself in their prototype chain, so `isExtendedError` returns
false for them. That is the honest answer: it is a `RangeError` that carries the same fields.

To type `context` as well, name both type parameters; TypeScript will not infer one when you supply
the other:

```ts
defineError<{ page: number }, RangeError>('PageError', { base: RangeError })
```

## `class … extends ExtendedError`

Use a class declaration when the error needs members of its own — an extra method, a computed
property, a narrower constructor.

```ts
import { ExtendedError } from 'ts-extended-errors'

class ConfigError extends ExtendedError<{ file: string; key: string }> {
  static override readonly code = 'CONFIG'

  get location(): string {
    return `${this.context?.file ?? '<unknown>'}:${this.context?.key ?? '<unknown>'}`
  }
}

const error = new ConfigError('missing "port"', {
  context: { file: 'app.config.json', key: 'port' },
  cause: new SyntaxError('Unexpected token }'),
})

error.location // 'app.config.json:port'
```

`code` is a `static` field, declared once for the class. The constructor reads it from the class
that was actually constructed, so a subclass that declares its own `code` gets that one and one that
does not inherits its parent's.

## Which to use

`defineError` for a class that is only a name, a code and a context — most of them. A `class`
declaration when there is behaviour to attach. They interoperate freely: `base` accepts a class you
declared, and you can extend a class `defineError` returned.

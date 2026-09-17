---
title: Why this exists
description: Four things that go wrong when you subclass Error in TypeScript, and what each one costs when the error reaches a log or a queue.
---

Nothing here is difficult. Each problem below has a well-known fix, each fix is three lines, and
each is easy to forget on the fifth error class. The package exists so that they are handled once.

## Subclassing `Error` does not give you a subclass

Extend `Error` and four things are quietly wrong:

```ts
class ConfigError extends Error {}

const error = new ConfigError('missing "port"')
error.name // 'Error' — not 'ConfigError'
```

`name` stays `'Error'`, so every log line and every `toString()` says `Error` for a class you
carefully named. `instanceof ConfigError` is false once the class is compiled down to ES5 or run
through a bundler that does, because `super()` returns a fresh `Error` object and the prototype
chain is lost. The stack's top frame is the constructor rather than the line that threw. And
`JSON.stringify(error)` is `{}`, because `message` and `stack` are non-enumerable on `Error`.

[`ExtendedError`](../under-the-hood/subclassing.md) fixes all four in its constructor, so a subclass
of it inherits the fixes rather than restating them.

## Branching on the message

Without a stable discriminator, callers end up matching on prose:

```ts
if (error.message.includes('not found')) {
  /* … */
}
```

That breaks the first time somebody rewords the message — which is a thing messages are for. Every
class here carries a `code`: a short machine-readable string, set once on the class rather than at
every throw site.

## Details interpolated into the message

The information a handler needs is usually formatted into the sentence and then unavailable:

```ts
throw new Error(`user ${userId} not found in tenant ${tenantId}`)
```

`context` is a typed object on the error, so the data stays data. The message is still a sentence
for a human, and `error.context.userId` is still a number.

## The error stops being an error at a boundary

Send an error through `JSON.stringify`, a `postMessage`, or a job queue and what arrives is a plain
object. `instanceof` is false for it, the `cause` chain is gone or flattened, and the handler on the
far side is back to reading strings.

[`serializeError` and `deserializeError`](../guides/serialization.md) are the two halves of that
round trip: a JSON-safe object going out, the original classes coming back — including the causes,
so `findCauseOf(error, NotFoundError)` works on the receiving end.

## Choosing an error model

“Typed” here describes an error after it has been caught and narrowed: its class, `code` and
`context`. TypeScript does not declare thrown errors in a function's signature, so this package
does not provide checked exceptions.

| Need                                                                         | Model                                                |
| ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| A message and stack that nobody branches on                                  | Native `Error`                                       |
| Structured exceptions, searchable causes and a JSON boundary                 | `ts-extended-errors`                                 |
| Expected failures that every caller sees in the function's return type       | A discriminated union or `Result<Value, ErrorValue>` |
| Typed failures as part of a wider runtime for effects, resources and retries | An effect system                                     |

These models compose. An `ExtendedError` subclass can be the error value in a `Result`, while
unexpected failures still use native `throw` and `catch`.

## When not to use it

- **You throw one kind of error and never inspect it.** A plain `Error` with a good message is fine,
  and one fewer dependency is worth something.
- **Every caller must see each expected failure in the function's type.** Return a discriminated
  union or a `Result<Value, ErrorValue>`; TypeScript does not track what a function throws.
- **Your application already runs inside an effect system.** Use its failure channel, resource
  model and retry machinery rather than introducing a parallel control-flow convention.
- **You need errors to cross a `vm` or realm boundary and still satisfy `instanceof`.** They cannot;
  two realms mean two distinct classes. Serialize instead — `serializeError` works on error-shaped
  values from anywhere, and `deserializeError` rebuilds them locally.
- **You want your framework's error type.** If your HTTP framework already defines the taxonomy your
  handlers switch on, adding a second one costs more than it returns.

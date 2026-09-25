---
title: ts-extended-errors
description: A zero-dependency error model for TypeScript applications that use native exceptions but need typed context, cause-chain inspection, and reliable JSON round trips.
---

`ts-extended-errors` is one small package for the part of an application that only runs when
something has already gone wrong. It gives you error classes that behave the way you expected
JavaScript's to behave, and a way to move them across a boundary — a queue, a worker, an HTTP
response, a log line — without losing what they were.

Node.js 20.19 or newer, no runtime dependencies, no Node APIs (so it runs in browsers and workers
too), ESM and CommonJS with type declarations. MIT.

```bash
npm install ts-extended-errors
```

## In one example

```ts
import { defineError, findCauseOf, serializeError, toError } from 'ts-extended-errors'

const HttpError = defineError('HttpError', { code: 'HTTP' })
const NotFoundError = defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })

function loadProfile(userId: number) {
  try {
    throw new NotFoundError('no such user', { context: { userId } })
  } catch (cause) {
    throw new HttpError('loading the profile failed', { cause })
  }
}

try {
  loadProfile(42)
} catch (thrown) {
  const error = toError(thrown) // `thrown` is `unknown`; `error` is an `Error`

  // Searches the whole cause chain, not just the outermost error.
  const notFound = findCauseOf(error, NotFoundError)
  notFound?.code // 'HTTP_NOT_FOUND'
  notFound?.context // { userId: 42 }

  console.log(JSON.stringify(serializeError(error, { includeStack: false })))
  // {"name":"HttpError","message":"loading the profile failed","code":"HTTP","cause":
  //   {"name":"NotFoundError","message":"no such user","code":"HTTP_NOT_FOUND",
  //    "context":{"userId":42}}}
}
```

## What it gives you

- **Subclasses that work.** `name` is the class name, `instanceof` holds even when a bundler
  transpiles the library to ES5 along with your code, and the stack starts at the throw site rather
  than inside the constructor. See [Subclassing `Error`](./under-the-hood/subclassing.md).
- **A code and a context.** A stable string per class to branch on, and a typed data object per
  error, so failure details stop being interpolated into prose and parsed back out.
- **One-line classes.** `defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })`
  builds a real class, and `base` builds families of them.
- **Cause chains you can search.** A low-level failure is usually wrapped two or three times before
  it reaches the handler that knows what to do about it.
- **A JSON round trip.** `serializeError` produces a plain object; `deserializeError` rebuilds it as
  the classes it was, so `instanceof` still works on the other side.
- **Tolerance for anything thrown.** Every function takes `unknown`, including strings, plain
  objects and `null`.

## Where to go next

- New to it: [Why this exists](./learn/why.md), then
  [Getting started](./learn/getting-started.md).
- Building a set of error classes: [Defining errors](./guides/defining-errors.md).
- Reporting failures: [Cause chains](./guides/cause-chains.md) and
  [Serialization](./guides/serialization.md).
- Looking something up: [API reference](./reference/api.md) and [Types](./reference/types.md).

## For coding agents

Every page here is also served as raw markdown — add `.md` to any URL. There is an
[`llms.txt`](https://rxova.org/packages/ts-extended-errors/llms.txt) index and an
[`llms-full.txt`](https://rxova.org/packages/ts-extended-errors/llms-full.txt) with every page
inlined. The package also ships its own `llms.txt` inside the tarball, readable from
`node_modules/ts-extended-errors/llms.txt` with no network access.

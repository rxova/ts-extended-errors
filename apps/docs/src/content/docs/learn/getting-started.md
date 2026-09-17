---
title: Getting started
description: Install the package, declare an error class, throw it with context, and catch it — the shortest path from nothing to a typed error.
---

## Install

```bash
npm install ts-extended-errors
```

No peer dependencies and nothing else to configure. Node.js 20.19 or newer; the package uses no Node
APIs, so bundlers targeting browsers and workers are equally fine. Both ESM and CommonJS entry
points ship, with type declarations for each.

TypeScript is not required, but the types are most of the point: `context` is typed per class, and
`findCauseOf` narrows to the class you pass it.

## Declare a class

`defineError` returns a real class. Call it once, at module scope, and export the result — two calls
return two different classes, and `instanceof` between them is false.

```ts
// errors.ts
import { defineError } from 'ts-extended-errors'

export const AppError = defineError('AppError', { code: 'APP' })

export const NotFoundError = defineError<{ id: string }>('NotFoundError', {
  base: AppError,
  code: 'NOT_FOUND',
})
```

`base` is what makes it a family: `NotFoundError` is an `AppError`, so a handler can catch the whole
family without knowing the leaves. The type parameter types `context` for this class.

## Throw it

The second argument is an options object — `context` and `cause` are fields of it, not positional
arguments.

```ts
import { NotFoundError } from './errors.js'

export function loadUser(id: string) {
  const user = users.get(id)
  if (!user) throw new NotFoundError(`no user ${id}`, { context: { id } })
  return user
}
```

## Wrap what you catch

When a failure crosses a layer, wrap it rather than replacing it. The original goes in `cause`, and
nothing is lost.

```ts
import { AppError } from './errors.js'

export function loadProfile(id: string) {
  try {
    return render(loadUser(id))
  } catch (cause) {
    throw new AppError('loading the profile failed', { cause })
  }
}
```

## Catch it

A `catch` binding is `unknown`, because JavaScript permits throwing anything. `findCauseOf` takes
`unknown`, searches the whole chain, and narrows to the class you asked for:

```ts
import { findCauseOf, toError } from 'ts-extended-errors'
import { NotFoundError } from './errors.js'

try {
  loadProfile('u_17')
} catch (thrown) {
  const notFound = findCauseOf(thrown, NotFoundError)
  if (notFound) return respond(404, { id: notFound.context?.id })

  // Anything else: narrow to a real Error and let the logger have it.
  logger.error(toError(thrown))
  return respond(500)
}
```

Using `thrown instanceof NotFoundError` here would return false: the error that reached this handler
is the `AppError` wrapping it. That is the one mistake worth internalising early — see
[Cause chains](../guides/cause-chains.md).

## Log it, or send it

`JSON.stringify(error)` already works, because every class here defines `toJSON`. For control over
what is included, call `serializeError` directly:

```ts
import { serializeError } from 'ts-extended-errors'

logger.error(serializeError(error)) // with stacks, for your own logs
response.json(serializeError(error, { includeStack: false })) // without, for a client
```

On the receiving end, `deserializeError` turns that object back into the classes it was. See
[Serialization](../guides/serialization.md).

## Next

- [Defining errors](../guides/defining-errors.md) — codes, taxonomies, generated messages, and when
  to use a `class` declaration instead.
- [Cause chains](../guides/cause-chains.md) — the five search helpers.
- [Working with unknown values](../guides/unknown-values.md) — `toError`, `isErrorLike`,
  `describeValue`.

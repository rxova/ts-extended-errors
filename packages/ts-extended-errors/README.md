# ts-extended-errors

Typed, serializable errors for TypeScript. Zero dependencies, dual ESM/CJS.

Subclassing `Error` in TypeScript goes wrong in four small ways — `name` still says `Error`,
`instanceof` returns false once the output is transpiled, the top stack frame is your constructor
instead of the throw site, and `JSON.stringify(error)` returns `{}`. Each is a two-line fix and each
is easy to forget. This package is those fixes, plus the two things you always end up writing next:
a factory for declaring an error taxonomy, and helpers for walking a `cause` chain.

```ts
import { defineError, findCauseOf, toError } from 'ts-extended-errors'

const HttpError = defineError('HttpError', { code: 'HTTP' })
const NotFoundError = defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })

try {
  await loadUser(id)
} catch (thrown) {
  const error = toError(thrown) // a catch binding is `unknown`
  const missing = findCauseOf(error, NotFoundError)
  if (missing) return render404(missing.context)
  throw error
}
```

## `ExtendedError`

The base class. Extend it directly when the error needs behaviour of its own.

```ts
class ConfigError extends ExtendedError<{ file: string }> {
  static override readonly code = 'CONFIG'
}

const error = new ConfigError('missing "port"', {
  context: { file: 'app.config.json' },
  cause: parseError,
})

error.name // 'ConfigError' — from new.target, not restated
error.code // 'CONFIG'    — copied off the class, so it survives serialization
error.context // { file: 'app.config.json' }
error instanceof ConfigError // true, including after downlevel compilation
JSON.stringify(error) // the whole error, cause chain included
```

`context` is the argument for structured data: the fields you would otherwise interpolate into the
message and then have to parse back out of a log.

`cause` is only defined on the instance when you actually pass one, so `'cause' in error` stays a
truthful answer to "is there anything below this".

## `defineError(name, options?)`

Declares a class in one line. It returns a real class — `instanceof` works, so does `extends`.

```ts
const HttpError = defineError('HttpError', { code: 'HTTP' })
const NotFoundError = defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })
const GoneError = defineError('GoneError', { base: HttpError }) // inherits code 'HTTP'

new NotFoundError('no such user') instanceof HttpError // true
```

`base` is what makes a taxonomy hold up: one `catch (e) { if (e instanceof HttpError) }` keeps
catching everything after you add the fifth subclass.

`base` also takes a built-in error class, or any error class of your own whose constructor takes
`(message, options)`, for when callers already catch that family:

```ts
const OutOfRangeError = defineError('OutOfRangeError', { base: RangeError, code: 'OUT_OF_RANGE' })

new OutOfRangeError('page 0') instanceof RangeError // true
```

Such a class gets everything an `ExtendedError` has: its own name, `code`, `context`, the `cause`
rule, a stack that starts at the throw and `toJSON`. What it cannot get is `ExtendedError` in its
prototype chain, because a class has one parent. So `instanceof ExtendedError` and `isExtendedError`
are false for it, while `findCauseOf(error, OutOfRangeError)` and `serializeError` work as usual. To
type `context` too, name both parameters: `defineError<{ page: number }, RangeError>(…)`.

## Walking the chain

`cause` is a chain, and the error a handler cares about is usually two or three wrappers down —
which a bare `error instanceof TimeoutError` will never see.

| Function                      | Returns                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| `causeChain(error)`           | every value from `error` down, outermost first             |
| `rootCause(error)`            | the deepest value — the original failure                   |
| `findCause(error, predicate)` | the first match, narrowed when `predicate` is a type guard |
| `findCauseOf(error, Class)`   | the first instance of `Class`, typed as `Class`            |
| `hasCauseOf(error, Class)`    | the same question as a boolean                             |

All of them take `unknown`, because `cause` is `unknown`: nothing stops a dependency from throwing
`{ cause: 'timeout' }`, and a walker that assumed otherwise would throw while you were trying to
report a failure. Cycles terminate.

## Serializing

```ts
serializeError(error) // → SerializedError, JSON-safe, cause chain included
serializeError(error, { includeStack: false, maxDepth: 3 })
serializeError(error, { includeOwnProperties: true }) // …plus the error's own fields
```

By default only the fixed fields are read — `name`, `message`, `code`, `stack`, `context` and
`cause` — which is everything an `ExtendedError` carries. An error class you did not write usually
keeps its useful data in fields of its own (`this.sortKey = sortKey`, `statusCode`, `errno`), and
those are lost. `includeOwnProperties: true` copies them too. An error in such a field is serialized
like a `cause`, under the same depth limit and cycle guard. Anything else is copied through a JSON
round trip, or described when it cannot survive one. Functions, `undefined` and getters that throw
are skipped. It is opt-in because those fields hold whatever the thrower put there — a request, a
token, a user — so turn it on for logs you control, not for a response body. The return type widens
to `SerializedErrorWithProperties` only when you do.

`serializeError` works on anything, not just `Error`: it reads fields structurally, so it also
handles errors from a worker, a `vm` context or a second bundled copy of a library — the ones where
`instanceof Error` is false but every field you want is present. Non-errors are described rather
than dropped, because `throw 'nope'` is rare but real and `{}` in a log is not a diagnosis.

`toError(value)` is the `catch` companion: errors pass through untouched (wrapping one would bury
the stack that says where it came from), anything else is wrapped with the original kept as `cause`.

## Deserializing

```ts
const error = deserializeError(JSON.parse(line), { classes: [HttpError, NotFoundError] })

error instanceof NotFoundError // true
findCauseOf(error, TimeoutError) // the rebuilt cause, typed
```

The way back from `serializeError`, after a JSON round trip, a `postMessage` or a queue. Each error
is rebuilt as the class its `name` names — one from `classes`, or a built-in such as `TypeError` —
by calling that class's constructor, so the result is a real error and `instanceof`, `findCauseOf`
and `hasCauseOf` work on it. Then `code`, `context`, `stack` and any fields `includeOwnProperties`
carried are put back as they were, and the `cause` chain is rebuilt the same way, down to
`maxDepth`. A name that matches no class comes back as an `ExtendedError` that keeps it. With no
serialized stack the result has none, rather than one that points at `deserializeError`.

The name comes from the payload, so `classes` is also the list of constructors a payload can reach:
pass the ones you expect, not every class you have.

## API

| Export                                                                                                                                                                                                                        | What it is                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `ExtendedError`                                                                                                                                                                                                               | the base class               |
| `isExtendedError(value)`                                                                                                                                                                                                      | `instanceof` narrowing guard |
| `defineError(name, options?)`                                                                                                                                                                                                 | class factory                |
| `causeChain` `rootCause` `findCause` `findCauseOf` `hasCauseOf`                                                                                                                                                               | chain helpers                |
| `serializeError` `deserializeError` `isErrorLike` `describeValue`                                                                                                                                                             | serialization                |
| `toError(value)`                                                                                                                                                                                                              | `unknown` → `Error`          |
| `ErrorContext` `ExtendedErrorOptions` `SerializedError` `SerializedErrorWithProperties` `SerializeErrorOptions` `DeserializeErrorOptions` `DefineErrorOptions` `ExtendedErrorConstructor` `ExtendedErrorMembers` `ErrorClass` | types                        |

MIT.

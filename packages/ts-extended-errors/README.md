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
```

`serializeError` works on anything, not just `Error`: it reads fields structurally, so it also
handles errors from a worker, a `vm` context or a second bundled copy of a library — the ones where
`instanceof Error` is false but every field you want is present. Non-errors are described rather
than dropped, because `throw 'nope'` is rare but real and `{}` in a log is not a diagnosis.

`toError(value)` is the `catch` companion: errors pass through untouched (wrapping one would bury
the stack that says where it came from), anything else is wrapped with the original kept as `cause`.

## API

| Export                                                                                                                          | What it is                   |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `ExtendedError`                                                                                                                 | the base class               |
| `isExtendedError(value)`                                                                                                        | `instanceof` narrowing guard |
| `defineError(name, options?)`                                                                                                   | class factory                |
| `causeChain` `rootCause` `findCause` `findCauseOf` `hasCauseOf`                                                                 | chain helpers                |
| `serializeError` `isErrorLike` `describeValue`                                                                                  | serialization                |
| `toError(value)`                                                                                                                | `unknown` → `Error`          |
| `ErrorContext` `ExtendedErrorOptions` `SerializedError` `SerializeErrorOptions` `DefineErrorOptions` `ExtendedErrorConstructor` | types                        |

MIT.

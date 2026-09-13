<h1 align="center">@rxova/ts-extended-errors</h1>

<p align="center">
  <a href="https://github.com/rxova/ts-extended-errors/actions/workflows/ci.yml"><img src="https://github.com/rxova/ts-extended-errors/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-~4.5%20kB-blue" alt="Brotli size about 4.5 kB" />
  <img src="https://img.shields.io/badge/coverage%20threshold-95%25-brightgreen" alt="Coverage threshold: 95% per file" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/node-%E2%89%A520.19-5fa04e?logo=node.js&logoColor=white" alt="Node 20.19 or newer" />
  <a href="https://github.com/rxova/ts-extended-errors/blob/main/packages/ts-extended-errors/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**Typed, serializable errors for TypeScript.** A base class for custom errors, a one-line class
factory, helpers for `cause` chains, and a JSON round trip that rebuilds the original classes.

Published to GitHub Packages. The `.npmrc` of the project that installs it routes the `@rxova`
scope there, with a GitHub token that has `read:packages`:

```ini
@rxova:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
npm install @rxova/ts-extended-errors
```

Requires Node.js 20.19 or newer. Ships ESM and CommonJS with type declarations, and has no runtime
dependencies. The code uses no Node.js APIs, so it also runs in browsers and other JavaScript
runtimes.

- **Subclasses** — `name` is the class name, `instanceof` holds after downlevel compilation, and the
  stack starts where the error was created
- **`code` and `context`** — a string code per class and a typed data object per error
- **One-line classes** — `defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })`
- **Cause chains** — find a cause by class or by predicate at any depth
- **JSON round trip** — `JSON.stringify(error)` includes the cause chain; `deserializeError` rebuilds
  it as the original classes
- **Any thrown value** — every function accepts `unknown`: strings, plain objects and `null` included

## Contents

- [Quick start](#quick-start)
- [`ExtendedError`](#extendederror)
- [`defineError`](#defineerrorname-options)
- [Cause chains](#cause-chains)
- [`serializeError`](#serializeerrorvalue-options)
- [`deserializeError`](#deserializeerrorvalue-options)
- [`toError`, `isErrorLike`, `describeValue`](#toerrorvalue)
- [Types](#types)

## Quick start

```ts
import { defineError, findCauseOf, serializeError, toError } from '@rxova/ts-extended-errors'

const HttpError = defineError('HttpError', { code: 'HTTP' })
const NotFoundError = defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })

function loadUser(userId: number) {
  throw new NotFoundError('no such user', { context: { userId } })
}

function loadProfile(userId: number) {
  try {
    return loadUser(userId)
  } catch (cause) {
    throw new HttpError('loading the profile failed', { cause })
  }
}

try {
  loadProfile(42)
} catch (thrown) {
  const error = toError(thrown) // `thrown` is `unknown`, `error` is an `Error`

  const notFound = findCauseOf(error, NotFoundError) // searches the whole chain
  notFound?.code // 'HTTP_NOT_FOUND'
  notFound?.context // { userId: 42 }

  console.log(JSON.stringify(serializeError(error, { includeStack: false })))
  // {"name":"HttpError","message":"loading the profile failed","code":"HTTP","cause":
  //   {"name":"NotFoundError","message":"no such user","code":"HTTP_NOT_FOUND","context":{"userId":42}}}
}
```

## `ExtendedError`

The base class. Extend it when an error needs fields or methods of its own.

```ts
import { ExtendedError, isExtendedError } from '@rxova/ts-extended-errors'

class ConfigError extends ExtendedError<{ file: string }> {
  static override readonly code = 'CONFIG'
}

const error = new ConfigError('missing "port"', {
  context: { file: 'app.config.json' },
  cause: new SyntaxError('Unexpected token } in JSON'),
})

error.name // 'ConfigError'
error.message // 'missing "port"'
error.code // 'CONFIG'
error.context // { file: 'app.config.json' }
error.cause // SyntaxError: Unexpected token } in JSON
error instanceof ConfigError // true
error instanceof ExtendedError // true
error.stack?.split('\n')[0] // 'ConfigError: missing "port"'

isExtendedError(error) // true
isExtendedError(new Error('x')) // false
```

`new ExtendedError<Context>(message, options?)`

| Option    | Type      | Sets                                            |
| --------- | --------- | ----------------------------------------------- |
| `cause`   | `unknown` | `error.cause`, the native `Error` cause         |
| `context` | `Context` | `error.context`, typed by the class's `Context` |

| Member     | Value                                                                   |
| ---------- | ----------------------------------------------------------------------- |
| `name`     | The class name                                                          |
| `code`     | The class's static `code`, or `undefined`                               |
| `context`  | `options.context`, or `undefined`                                       |
| `cause`    | `options.cause`. The property exists only when a cause was passed       |
| `stack`    | Starts at the line that created the error, not inside the constructor   |
| `toJSON()` | `serializeError(this)`, so `JSON.stringify(error)` includes every field |

`isExtendedError(value)` returns `value instanceof ExtendedError`, typed as a type guard.

## `defineError(name, options?)`

Returns a new error class. The result is the same as extending `ExtendedError` with a static `code`.

```ts
import { ExtendedError, defineError } from '@rxova/ts-extended-errors'

const HttpError = defineError('HttpError', { code: 'HTTP' })
const NotFoundError = defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })
const GoneError = defineError('GoneError', { base: HttpError }) // no code: inherits 'HTTP'

const error = new NotFoundError('no such user', { context: { userId: 42 } })

error.name // 'NotFoundError'
error.code // 'HTTP_NOT_FOUND'
error.context // { userId: 42 }
error instanceof NotFoundError // true
error instanceof HttpError // true
error instanceof ExtendedError // true
NotFoundError.code // 'HTTP_NOT_FOUND'
new GoneError('deleted').code // 'HTTP'
```

| Option | Type        | Default           | Description                                          |
| ------ | ----------- | ----------------- | ---------------------------------------------------- |
| `code` | `string`    | the base's `code` | Copied to every instance                             |
| `base` | error class | `ExtendedError`   | The class to extend; see [other bases](#other-bases) |

The first type parameter types `context`:

```ts
import { defineError } from '@rxova/ts-extended-errors'

const RateLimitError = defineError<{ retryAfter: number }>('RateLimitError', { code: 'RATE_LIMIT' })

new RateLimitError('slow down', { context: { retryAfter: 30 } }).context?.retryAfter // 30

// @ts-expect-error: retryAfter is a number
new RateLimitError('slow down', { context: { retryAfter: '30' } })
```

The returned class can be extended like any other:

```ts
import { defineError } from '@rxova/ts-extended-errors'

const HttpError = defineError('HttpError', { code: 'HTTP' })

class ServiceUnavailableError extends HttpError {
  readonly retryAfter = 30
}

const error = new ServiceUnavailableError('try again later')
error.name // 'ServiceUnavailableError'
error.code // 'HTTP'
error.retryAfter // 30
```

### Other bases

`base` also accepts a built-in error class (`RangeError`, `TypeError`, …) or any error class whose
constructor takes `(message, options)`. To type `context` as well, pass both type parameters.

```ts
import { ExtendedError, defineError, isExtendedError } from '@rxova/ts-extended-errors'

const OutOfRangeError = defineError<{ page: number }, RangeError>('OutOfRangeError', {
  base: RangeError,
  code: 'OUT_OF_RANGE',
})

const error = new OutOfRangeError('page must be 1 or more', { context: { page: 0 } })

error instanceof RangeError // true
error.code // 'OUT_OF_RANGE'
error.context?.page // 0
error instanceof ExtendedError // false
isExtendedError(error) // false
```

Instances have the same members as an `ExtendedError` (`name`, `code`, `context`, `cause`, `stack`,
`toJSON`), but `ExtendedError` is not in their prototype chain.

## Cause chains

Five functions walk `error`, `error.cause`, `error.cause.cause` and so on. The chain includes `error`
itself. All of them accept `unknown`, and a cycle ends the walk.

```ts
import {
  ExtendedError,
  causeChain,
  defineError,
  findCause,
  findCauseOf,
  hasCauseOf,
  isExtendedError,
  rootCause,
} from '@rxova/ts-extended-errors'

const HttpError = defineError('HttpError', { code: 'HTTP' })
const TimeoutError = defineError<{ ms: number }>('TimeoutError', { code: 'TIMEOUT' })

const timeout = new TimeoutError('upstream took 5000ms', { context: { ms: 5000 } })
const request = new HttpError('GET /users/42 failed', { cause: timeout })
const error = new ExtendedError('loading the profile failed', { cause: request })

causeChain(error).length // 3: [error, request, timeout]
rootCause(error) === timeout // true
findCauseOf(error, TimeoutError)?.context?.ms // 5000
findCauseOf(error, RangeError) // undefined
hasCauseOf(error, HttpError) // true
findCause(error, (cause) => isExtendedError(cause) && cause.code === 'TIMEOUT') === timeout // true

causeChain(new Error('request failed', { cause: 'ECONNRESET' })).at(-1) // 'ECONNRESET'
causeChain(null) // []
```

| Function                      | Returns                                                                  |
| ----------------------------- | ------------------------------------------------------------------------ |
| `causeChain(error)`           | `unknown[]`: `error`, then each `cause`, outermost first                 |
| `rootCause(error)`            | The last value in the chain                                              |
| `findCause(error, predicate)` | The first value `predicate` accepts, typed by it when it is a type guard |
| `findCauseOf(error, Class)`   | The first instance of `Class`, typed as that class, or `undefined`       |
| `hasCauseOf(error, Class)`    | `true` when the chain contains an instance of `Class`                    |

## `serializeError(value, options?)`

Returns a plain, JSON-safe object: `name`, `message`, and `code`, `stack`, `context` and `cause`
when present. `cause` is serialized the same way, recursively.

```ts
import { ExtendedError, defineError, serializeError } from '@rxova/ts-extended-errors'

const TimeoutError = defineError('TimeoutError', { code: 'TIMEOUT' })

const error = new ExtendedError('loading the profile failed', {
  cause: new TimeoutError('upstream took 5000ms', { context: { ms: 5000 } }),
})

serializeError(error, { includeStack: false })
// {
//   name: 'ExtendedError',
//   message: 'loading the profile failed',
//   cause: { name: 'TimeoutError', message: 'upstream took 5000ms', code: 'TIMEOUT', context: { ms: 5000 } }
// }

serializeError(error, { includeStack: false, maxDepth: 0 })
// { name: 'ExtendedError', message: 'loading the profile failed' }

serializeError('timeout') // { name: 'string', message: 'timeout' }
serializeError(null) // { name: 'object', message: 'null' }
```

| Option                 | Type      | Default | Description                                        |
| ---------------------- | --------- | ------- | -------------------------------------------------- |
| `maxDepth`             | `number`  | `8`     | How many `cause` levels to include below the top   |
| `includeStack`         | `boolean` | `true`  | Include `stack`                                    |
| `includeOwnProperties` | `boolean` | `false` | Also copy the error's other own fields (see below) |

By default only the fields above are read. `includeOwnProperties: true` also copies any other own
field of each error in the chain, and widens the return type to `SerializedErrorWithProperties`:

```ts
import { serializeError } from '@rxova/ts-extended-errors'

class DbError extends Error {
  constructor(
    message: string,
    readonly sortKey: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'DbError'
  }
}

const error = new DbError('conditional check failed', 'user#42', 409)

serializeError(error, { includeStack: false })
// { name: 'DbError', message: 'conditional check failed' }

serializeError(error, { includeStack: false, includeOwnProperties: true })
// { name: 'DbError', message: 'conditional check failed', sortKey: 'user#42', status: 409 }
```

Errors in those fields are serialized like a `cause`. Other values are copied through a JSON round
trip, or described with `describeValue` when they cannot be. Functions, `undefined` and getters that
throw are skipped. The fields may hold anything the thrower put there, such as request data.

Values that are not errors become `{ name: typeof value, message: describeValue(value) }`. Objects
with a string `message` are read field by field, so errors from another realm (a worker, an iframe,
a `vm` context) serialize like local ones.

## `deserializeError(value, options?)`

Rebuilds the output of `serializeError` as real errors, cause chain included.

```ts
import { defineError, deserializeError, findCauseOf } from '@rxova/ts-extended-errors'

const HttpError = defineError('HttpError', { code: 'HTTP' })
const NotFoundError = defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })

// Sender
const sent = new HttpError('GET /users/42 failed', {
  cause: new NotFoundError('no such user', { context: { userId: 42 } }),
})
const payload = JSON.stringify(sent)

// Receiver
const error = deserializeError(JSON.parse(payload), { classes: [HttpError, NotFoundError] })

error instanceof HttpError // true
error.cause instanceof NotFoundError // true
findCauseOf(error, NotFoundError)?.context // { userId: 42 }
error.stack === sent.stack // true
```

- Each error is created with the class whose `name` equals its `name` field. `Error`, `EvalError`,
  `RangeError`, `ReferenceError`, `SyntaxError`, `TypeError` and `URIError` are always available;
  classes in `classes` take precedence over them.
- A name that matches no class produces an `ExtendedError` with that name.
- `code`, `context`, `stack` and any fields from `includeOwnProperties` are restored. Without a
  serialized `stack`, the result has no `stack`.
- An `Error` instance is returned unchanged. Other values that are not error-like go through
  `toError`.

```ts
import { ExtendedError, deserializeError } from '@rxova/ts-extended-errors'

const error = deserializeError({ name: 'PaymentError', message: 'card declined', code: 'CARD' })

error.name // 'PaymentError'
error instanceof ExtendedError // true
deserializeError({ name: 'TypeError', message: 'x is not a function' }) instanceof TypeError // true
```

| Option     | Type                    | Default | Description                                                       |
| ---------- | ----------------------- | ------- | ----------------------------------------------------------------- |
| `classes`  | `readonly ErrorClass[]` | `[]`    | Classes to rebuild errors as, matched by their `name` property    |
| `maxDepth` | `number`                | `8`     | How many `cause` levels to rebuild; deeper ones stay as they came |

The class is chosen by a `name` read from the payload, so list only the classes the payload is
expected to contain.

## `toError(value)`

Returns an `Error` for any value, for use in `catch` blocks, where the caught value is `unknown`.

```ts
import { ExtendedError, toError } from '@rxova/ts-extended-errors'

const original = new TypeError('x is not a function')
toError(original) === original // true: errors are returned unchanged

const fromString = toError('timeout')
fromString instanceof ExtendedError // true
fromString.message // 'timeout'
fromString.cause // 'timeout'

toError({ status: 500 }).message // '{"status":500}'
toError({ name: 'TypeError', message: 'x is not a function' }).name // 'TypeError'
```

An object with a string `message` becomes an `ExtendedError` with its `name`, `message` and `stack`.
Any other value becomes an `ExtendedError` whose message is `describeValue(value)`. In both cases the
original value is kept as `cause`.

## `isErrorLike(value)`

`true` for any object with a string `message`, including errors from another realm, where
`instanceof Error` is `false`.

```ts
import { isErrorLike } from '@rxova/ts-extended-errors'

isErrorLike(new Error('x')) // true
isErrorLike({ message: 'x' }) // true
isErrorLike({}) // false
isErrorLike('x') // false
```

## `describeValue(value)`

A one-line string for any value. `serializeError` and `toError` use it for values that are not
errors.

```ts
import { describeValue } from '@rxova/ts-extended-errors'

describeValue('timeout') // 'timeout'
describeValue(42) // '42'
describeValue(10n) // '10n'
describeValue(Symbol('id')) // 'Symbol(id)'
describeValue({ status: 500 }) // '{"status":500}'
describeValue(undefined) // 'undefined'
```

## Types

| Type                                          | Description                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `ErrorContext`                                | `Readonly<Record<string, unknown>>`, the constraint on `context`         |
| `ExtendedErrorOptions<Context>`               | `{ cause?: unknown; context?: Context }`                                 |
| `SerializedError`                             | `{ name; message; code?; stack?; context?; cause?: SerializedError }`    |
| `SerializedErrorWithProperties`               | `SerializedError` plus other fields, from `includeOwnProperties: true`   |
| `SerializeErrorOptions`                       | Options of `serializeError`                                              |
| `DeserializeErrorOptions`                     | Options of `deserializeError`                                            |
| `DefineErrorOptions<Context>`                 | Options of `defineError`                                                 |
| `ExtendedErrorConstructor<Context, Instance>` | The class `defineError` returns                                          |
| `ExtendedErrorMembers<Context>`               | `name`, `code`, `context` and `toJSON`, added to any `defineError` class |
| `ErrorClass<Instance>`                        | An error class whose constructor takes `(message, options)`              |

## For coding agents

`node_modules/@rxova/ts-extended-errors/llms.txt` has the API table, a working example and the common
mistakes in one file.

## License

[MIT](https://github.com/rxova/ts-extended-errors/blob/main/packages/ts-extended-errors/LICENSE) ©
Jonatan Kruszewski

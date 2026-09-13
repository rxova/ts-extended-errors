import { runInNewContext } from 'node:vm'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { causeChain, findCauseOf, rootCause } from '../chain'
import { defineError } from '../defineError'
import { deserializeError } from '../deserialize'
import type { DeserializeErrorOptions } from '../deserialize'
import { ExtendedError } from '../ExtendedError'
import { serializeError } from '../serialize'

const HttpError = defineError('HttpError', { code: 'HTTP' })
const NotFoundError = defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })
const TimeoutError = defineError('TimeoutError', { code: 'TIMEOUT' })
const OutOfRangeError = defineError('OutOfRangeError', { base: RangeError, code: 'OUT_OF_RANGE' })

class ConfigError extends ExtendedError<{ file: string }> {
  static override readonly code = 'CONFIG'
}

const classes = [HttpError, NotFoundError, TimeoutError, OutOfRangeError, ConfigError]

const builtIns = [Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError]

/** What arrives on the other side of a log line or a queue. */
const roundTrip = (error: unknown, options?: DeserializeErrorOptions): Error =>
  deserializeError(JSON.parse(JSON.stringify(serializeError(error))), options)

const expectInstance = <T>(value: unknown, Class: abstract new (...args: never[]) => T): T => {
  expect(value).toBeInstanceOf(Class)
  return value as T
}

describe('deserializeError', () => {
  it('rebuilds a real error from serialized output', () => {
    const original = new Error('boom')

    const back = roundTrip(original)

    expect(back).toBeInstanceOf(Error)
    expect(Object.prototype.toString.call(back)).toBe('[object Error]')
    expect(back.name).toBe('Error')
    expect(back.message).toBe('boom')
    expect(back.stack).toBe(original.stack)
  })

  it.each(builtIns.map((Base) => [Base.name, Base] as const))('rebuilds a %s as one', (_, Base) => {
    const back = roundTrip(new Base('boom'))

    expect(back.constructor).toBe(Base)
    expect(back.name).toBe(Base.name)
  })

  it('rebuilds a class it is given, with the fields its constructor sets', () => {
    const original = new NotFoundError('no such user', { context: { id: 7 } })

    const back = expectInstance(roundTrip(original, { classes }), NotFoundError)

    expect(back).toBeInstanceOf(HttpError)
    expect(back).toBeInstanceOf(ExtendedError)
    expect(back.name).toBe('NotFoundError')
    expect(back.code).toBe('HTTP_NOT_FOUND')
    expect(back.context).toEqual({ id: 7 })
    expect(new Set(Object.keys(back))).toEqual(new Set(Object.keys(original)))
  })

  it('rebuilds a class declared with the class syntax', () => {
    const original = new ConfigError('missing "port"', { context: { file: 'app.config.json' } })

    const back = expectInstance(roundTrip(original, { classes }), ConfigError)

    expect(back.code).toBe('CONFIG')
    expect(back.context).toEqual({ file: 'app.config.json' })
  })

  it('rebuilds a class defined on a built-in base', () => {
    const back = expectInstance(
      roundTrip(new OutOfRangeError('page 0'), { classes }),
      OutOfRangeError,
    )

    expect(back).toBeInstanceOf(RangeError)
    expect(back.code).toBe('OUT_OF_RANGE')
  })

  it('prefers a class it is given over a built-in of the same name', () => {
    const OwnTypeError = defineError('TypeError')

    expect(roundTrip(new TypeError('boom'), { classes: [OwnTypeError] })).toBeInstanceOf(
      OwnTypeError,
    )
  })

  it('falls back to an ExtendedError that keeps the name, code and context', () => {
    const back = expectInstance(
      deserializeError({
        name: 'PaymentError',
        message: 'declined',
        code: 'CARD',
        context: { last4: '4242' },
      }),
      ExtendedError,
    )

    expect(back.name).toBe('PaymentError')
    expect(back.code).toBe('CARD')
    expect(back.context).toEqual({ last4: '4242' })
    expect(new Set(Object.keys(back))).toEqual(new Set(['name', 'code', 'context']))
  })

  it('puts code and context on a built-in error as fields, leaving name on the prototype', () => {
    const back = deserializeError({
      name: 'TypeError',
      message: 'boom',
      code: 'E_TYPE',
      context: { a: 1 },
    })

    expect(back.constructor).toBe(TypeError)
    expect(Object.keys(back)).toEqual(['code', 'context'])
    expect(Reflect.get(back, 'code')).toBe('E_TYPE')
    expect(Reflect.get(back, 'context')).toEqual({ a: 1 })
  })

  it('reads a missing or non-string name as Error', () => {
    expect(deserializeError({ message: 'boom' }).constructor).toBe(Error)
    expect(deserializeError({ name: 42, message: 'boom' }).name).toBe('Error')
  })

  it('ignores a code that is not a string and a context that is not an object', () => {
    const back = deserializeError({ name: 'Error', message: 'boom', code: 42, context: 'no' })

    expect('code' in back).toBe(false)
    expect('context' in back).toBe(false)
  })

  it('has no stack when none was serialized, rather than one pointing here', () => {
    const serialized = serializeError(new Error('boom'), { includeStack: false })

    expect(deserializeError(serialized).stack).toBeUndefined()
  })

  it('rebuilds the cause chain', () => {
    const original = new HttpError('request failed', {
      cause: new TimeoutError('upstream', { cause: new Error('socket hang up') }),
    })

    const back = roundTrip(original, { classes })

    expect(causeChain(back).map((error) => (error as Error).name)).toEqual([
      'HttpError',
      'TimeoutError',
      'Error',
    ])
    expect(findCauseOf(back, TimeoutError)?.code).toBe('TIMEOUT')
    expect(rootCause(back)).toBeInstanceOf(Error)
  })

  it('does not define cause when none was serialized', () => {
    expect('cause' in roundTrip(new Error('boom'))).toBe(false)
  })

  it('serializes back to what it was built from', () => {
    const original = new NotFoundError('no such user', {
      context: { id: 7 },
      cause: new TimeoutError('upstream', { cause: new RangeError('socket hang up') }),
    })

    expect(serializeError(roundTrip(original, { classes }))).toEqual(serializeError(original))
  })

  it('restores own fields, rebuilding the errors among them and keeping data as data', () => {
    class SortError extends Error {
      readonly sortKey = 'createdAt'
      readonly original = new TypeError('bad compare')
      readonly response = { message: 'Not found', status: 404 }
    }
    const original = new SortError('cannot sort')
    const serialized = serializeError(original, { includeOwnProperties: true })

    const back = deserializeError(JSON.parse(JSON.stringify(serialized)))

    expect(Reflect.get(back, 'sortKey')).toBe('createdAt')
    expect(Reflect.get(back, 'original')).toBeInstanceOf(TypeError)
    expect(Reflect.get(back, 'response')).toEqual({ message: 'Not found', status: 404 })
    expect(Reflect.get(back, 'response')).not.toBeInstanceOf(Error)
    expect(serializeError(back, { includeOwnProperties: true })).toEqual(serialized)
  })

  it('keeps a field spelled __proto__ as a field', () => {
    const back = deserializeError(
      JSON.parse('{"name":"Error","message":"boom","__proto__":{"polluted":true}}'),
    )

    expect(Object.getPrototypeOf(back)).toBe(Error.prototype)
    expect(Object.getOwnPropertyDescriptor(back, '__proto__')?.value).toEqual({ polluted: true })
    expect(Reflect.get({}, 'polluted')).toBeUndefined()
  })

  it('stops at maxDepth, leaving deeper causes as they came', () => {
    const deepest = { name: 'Error', message: 'c' }
    const middle = { name: 'Error', message: 'b', cause: deepest }
    const serialized = { name: 'Error', message: 'a', cause: middle }

    const back = deserializeError(serialized, { maxDepth: 1 })

    expect(back.cause).toBeInstanceOf(Error)
    expect((back.cause as Error).cause).toBe(deepest)
    expect(deserializeError(serialized, { maxDepth: 0 }).cause).toBe(middle)
  })

  it('terminates on a cycle', () => {
    const looped: Record<string, unknown> = { name: 'Error', message: 'loop' }
    looped.cause = looped

    expect(deserializeError(looped).cause).toBe(looped)
  })

  it('keeps a real error in the chain as it is', () => {
    const inner = new TypeError('already real')

    expect(deserializeError({ name: 'Error', message: 'outer', cause: inner }).cause).toBe(inner)
  })

  it('keeps a cause that is not error-shaped', () => {
    expect(deserializeError({ name: 'Error', message: 'outer', cause: 'timeout' }).cause).toBe(
      'timeout',
    )
  })

  it('returns a real error untouched', () => {
    const error = new RangeError('page 0')

    expect(deserializeError(error)).toBe(error)
  })

  it('wraps anything that is not error-shaped, as toError does', () => {
    const back = expectInstance(deserializeError('boom'), ExtendedError)

    expect(back.message).toBe('boom')
    expect(back.cause).toBe('boom')
    expect(deserializeError(null).message).toBe('null')
  })

  it("rebuilds an error from another realm as this realm's class", () => {
    const foreign = runInNewContext('new RangeError("page 0")') as Error

    const back = deserializeError(foreign)

    expect(back).toBeInstanceOf(RangeError)
    expect(back.stack).toBe(foreign.stack)
  })

  it('returns Error, and takes only classes with a (message, options) constructor', () => {
    expectTypeOf(deserializeError).returns.toEqualTypeOf<Error>()

    class StatusError extends Error {
      constructor(status: number) {
        super(String(status))
      }
    }

    // @ts-expect-error: a class must take `(message, options)` to be rebuilt
    expect(deserializeError({}, { classes: [StatusError] })).toBeInstanceOf(ExtendedError)
  })
})

describe('deserializeError with an AggregateError', () => {
  it('rebuilds it with its errors, each as its own class', () => {
    const original = new AggregateError(
      [new TypeError('a'), new NotFoundError('b', { context: { id: 7 } })],
      'all failed',
      { cause: new Error('c') },
    )

    const back = expectInstance(roundTrip(original, { classes }), AggregateError)

    expect(back.errors[0]).toBeInstanceOf(TypeError)
    expect(findCauseOf(back.errors[1], NotFoundError)?.context).toEqual({ id: 7 })
    expect(back.cause).toBeInstanceOf(Error)
    expect(back.stack).toBe(original.stack)
    expect(serializeError(back)).toEqual(serializeError(original))
  })

  it('carries errorsOmitted through a relay without listing it among the fields', () => {
    const original = new AggregateError(
      Array.from({ length: 5 }, (_, index) => new Error(`attempt ${String(index)}`)),
      'all failed',
    )
    const payload = serializeError(original, { maxAggregatedErrors: 2 })

    const back = deserializeError(JSON.parse(JSON.stringify(payload)))

    expect(Reflect.get(back, 'errorsOmitted')).toBe(3)
    expect(Object.keys(back)).toEqual([])
    expect(serializeError(back)).toEqual(payload)
  })

  it('leaves a payload without errors, from a sender that did not write them, an ExtendedError', () => {
    const back = deserializeError({ name: 'AggregateError', message: 'all failed' })

    expect(Object.getPrototypeOf(back)).toBe(ExtendedError.prototype)
    expect(back.name).toBe('AggregateError')
  })

  it('gives the errors to a class of your own by that name', () => {
    const OwnAggregateError = defineError('AggregateError')

    const back = expectInstance(
      deserializeError(
        {
          name: 'AggregateError',
          message: 'all failed',
          errors: [{ name: 'TypeError', message: 'a' }],
        },
        { classes: [OwnAggregateError] },
      ),
      OwnAggregateError,
    )

    const [first] = Reflect.get(back, 'errors') as unknown[]
    expect(first).toBeInstanceOf(TypeError)
    expect(Object.keys(back)).not.toContain('errors')
  })

  it('leaves errors below maxDepth as they came', () => {
    const inner = { name: 'Error', message: 'a' }

    const back = expectInstance(
      deserializeError(
        { name: 'AggregateError', message: 'all failed', errors: [inner] },
        {
          maxDepth: 0,
        },
      ),
      AggregateError,
    )

    expect(back.errors[0]).toBe(inner)
  })

  it('keeps errors as data under any other name', () => {
    const back = deserializeError({
      name: 'ValidationError',
      message: 'invalid',
      errors: ['email is required'],
    })

    expect(Reflect.get(back, 'errors')).toEqual(['email is required'])
  })
})

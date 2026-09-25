import { runInNewContext } from 'node:vm'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { describeValue, isErrorLike, serializeError } from '../serialize'
import type { SerializeErrorOptions } from '../serialize'
import { ExtendedError } from '../ExtendedError'
import type { SerializedError, SerializedErrorWithProperties } from '../types'

describe('serializeError', () => {
  it('captures the fields JSON.stringify would drop', () => {
    const serialized = serializeError(new Error('boom'))

    expect(serialized.name).toBe('Error')
    expect(serialized.message).toBe('boom')
    expect(serialized.stack).toBeTypeOf('string')
  })

  it('includes code and context when present', () => {
    class ConfigError extends ExtendedError<{ file: string }> {
      static override readonly code = 'CONFIG'
    }

    const serialized = serializeError(new ConfigError('boom', { context: { file: 'a.json' } }))

    expect(serialized.code).toBe('CONFIG')
    expect(serialized.context).toEqual({ file: 'a.json' })
  })

  it('omits code and context when absent', () => {
    const serialized = serializeError(new Error('boom'))

    expect('code' in serialized).toBe(false)
    expect('context' in serialized).toBe(false)
  })

  it('walks the cause chain', () => {
    const error = new ExtendedError('outer', {
      cause: new ExtendedError('middle', { cause: new Error('inner') }),
    })

    expect(serializeError(error).cause?.cause?.message).toBe('inner')
  })

  it('stops at maxDepth', () => {
    const error = new ExtendedError('a', {
      cause: new ExtendedError('b', { cause: new ExtendedError('c') }),
    })

    const serialized = serializeError(error, { maxDepth: 1 })

    expect(serialized.cause?.message).toBe('b')
    expect(serialized.cause?.cause).toBeUndefined()
  })

  it('omits the stack on request', () => {
    const serialized = serializeError(new Error('boom'), { includeStack: false })

    expect('stack' in serialized).toBe(false)
  })

  it('terminates on a cause cycle', () => {
    const a = new ExtendedError('a')
    const b = new ExtendedError('b', { cause: a })
    Object.defineProperty(a, 'cause', { value: b, configurable: true })

    const serialized = serializeError(b)

    expect(serialized.message).toBe('b')
    expect(serialized.cause?.message).toBe('a')
    expect(serialized.cause?.cause).toBeUndefined()
  })

  it('describes a non-error throw rather than returning an empty object', () => {
    expect(serializeError('nope')).toEqual({ name: 'string', message: 'nope' })
    expect(serializeError(42)).toEqual({ name: 'number', message: '42' })
  })

  it('serializes a non-error cause', () => {
    const error = new ExtendedError('wrapper', { cause: { code: 'E_WEIRD' } })

    expect(serializeError(error).cause).toEqual({ name: 'object', message: '{"code":"E_WEIRD"}' })
  })

  it('is JSON-safe end to end', () => {
    const error = new ExtendedError('outer', { cause: new Error('inner') })

    expect(() => JSON.stringify(serializeError(error))).not.toThrow()
  })

  it('handles a cross-realm error that fails instanceof', () => {
    // Structurally an error, structurally not an Error: exactly what arrives
    // from a worker, a vm context or a second copy of a library.
    const foreign = Object.create(null) as Record<string, unknown>
    foreign.name = 'ForeignError'
    foreign.message = 'from elsewhere'

    expect(foreign).not.toBeInstanceOf(Error)
    expect(serializeError(foreign)).toEqual({ name: 'ForeignError', message: 'from elsewhere' })
  })

  it('falls back to Error when the name is not a string', () => {
    const weird = { message: 'boom', name: 42 }

    expect(serializeError(weird).name).toBe('Error')
  })

  it('stops a self-referencing cause at once rather than repeating the error', () => {
    const error = new ExtendedError('loop')
    Object.defineProperty(error, 'cause', { value: error, configurable: true })

    const serialized = serializeError(error)

    expect(serialized.message).toBe('loop')
    expect(serialized.cause).toBeUndefined()
  })

  it('drops the stack at every level of the chain, not only the top', () => {
    const error = new ExtendedError('outer', { cause: new Error('inner') })

    const serialized = serializeError(error, { includeStack: false })

    expect('stack' in serialized).toBe(false)
    expect(serialized.cause).toEqual({ name: 'Error', message: 'inner' })
  })

  it('keeps only the outermost error at maxDepth 0', () => {
    const error = new ExtendedError('outer', { cause: new Error('inner') })

    expect(serializeError(error, { maxDepth: 0, includeStack: false })).toEqual({
      name: 'ExtendedError',
      message: 'outer',
    })
  })

  it('keeps a numeric code, the way a DOMException or a driver error carries one', () => {
    const error = Object.assign(new Error('boom'), { code: 404 })

    expect(serializeError(error, { includeStack: false })).toEqual({
      name: 'Error',
      message: 'boom',
      code: 404,
    })
    expect(
      serializeError(new DOMException('aborted', 'AbortError'), { includeStack: false }),
    ).toEqual({ name: 'AbortError', message: 'aborted', code: DOMException.ABORT_ERR })
  })

  it('ignores a code that is neither a string nor a finite number, and a context that is not an object', () => {
    const error = Object.assign(new Error('boom'), { code: { status: 404 }, context: 'no' })
    const infinite = Object.assign(new Error('boom'), { code: Number.POSITIVE_INFINITY })

    expect(serializeError(error, { includeStack: false })).toEqual({
      name: 'Error',
      message: 'boom',
    })
    expect(serializeError(infinite, { includeStack: false })).toEqual({
      name: 'Error',
      message: 'boom',
    })
  })

  it('reads a real error from another realm', () => {
    const foreign: unknown = runInNewContext('new TypeError("from a vm")')

    expect(foreign).not.toBeInstanceOf(Error)
    const serialized = serializeError(foreign)
    expect(serialized.name).toBe('TypeError')
    expect(serialized.message).toBe('from a vm')
    expect(serialized.stack).toContain('TypeError: from a vm')
  })

  it('describes null and undefined throws', () => {
    expect(serializeError(null)).toEqual({ name: 'object', message: 'null' })
    expect(serializeError(undefined)).toEqual({ name: 'undefined', message: 'undefined' })
  })

  it('widens the return type only when own properties are asked for', () => {
    const error = new Error('boom')
    const maybe: SerializeErrorOptions = { includeOwnProperties: true }

    expectTypeOf(serializeError(error)).toEqualTypeOf<SerializedError>()
    expectTypeOf(
      serializeError(error, { includeOwnProperties: false }),
    ).toEqualTypeOf<SerializedError>()
    // A plain boolean may be false, so the wide type is not promised.
    expectTypeOf(serializeError(error, maybe)).toEqualTypeOf<SerializedError>()
    expectTypeOf(
      serializeError(error, { includeOwnProperties: true }),
    ).toEqualTypeOf<SerializedErrorWithProperties>()
  })
})

/** Shaped like trainmf's sync-store error: the useful data is a field of its own. */
class CorruptDeviceError extends Error {
  readonly sortKey: string

  constructor(sortKey: string) {
    super(`Unreadable device item: ${sortKey}`)
    this.name = 'CorruptDeviceError'
    this.sortKey = sortKey
  }
}

/** Stack off, so the expectations below can state the whole output. */
const withOwn = (value: unknown, options: SerializeErrorOptions = {}) =>
  serializeError(value, { ...options, includeStack: false, includeOwnProperties: true })

describe('serializeError with includeOwnProperties', () => {
  it('copies a field an error class assigns in its constructor', () => {
    expect(withOwn(new CorruptDeviceError('DEVICE#watch-7f3a'))).toEqual({
      name: 'CorruptDeviceError',
      message: 'Unreadable device item: DEVICE#watch-7f3a',
      sortKey: 'DEVICE#watch-7f3a',
    })
  })

  it('leaves such fields out unless asked', () => {
    expect('sortKey' in serializeError(new CorruptDeviceError('k'))).toBe(false)
  })

  it('copies the fields of every error down the cause chain', () => {
    const error = new Error('sync pull failed', { cause: new CorruptDeviceError('k') })

    expect(withOwn(error).cause).toEqual({
      name: 'CorruptDeviceError',
      message: 'Unreadable device item: k',
      sortKey: 'k',
    })
  })

  it('never lets a field overwrite one of the fixed fields', () => {
    // `code` and `context` are own and enumerable, but not what the fixed
    // fields take: they stay absent rather than changing type.
    const error = Object.assign(new Error('boom'), {
      name: 'RenamedError',
      code: { status: 404 },
      context: 'not an object',
    })

    expect(withOwn(error)).toEqual({ name: 'RenamedError', message: 'boom' })
  })

  it('does not repeat the fields an ExtendedError already reports', () => {
    class ConfigError extends ExtendedError<{ file: string }> {
      static override readonly code = 'CONFIG'
    }
    const error = new ConfigError('boom', {
      context: { file: 'a.json' },
      cause: new Error('inner'),
    })

    expect(new Set(Object.keys(withOwn(error)))).toEqual(
      new Set(['name', 'message', 'code', 'context', 'cause']),
    )
  })

  it('serializes an error held in a field the way it serializes a cause', () => {
    const error = Object.assign(new Error('write failed'), {
      original: new CorruptDeviceError('k'),
    })

    expect(withOwn(error).original).toEqual({
      name: 'CorruptDeviceError',
      message: 'Unreadable device item: k',
      sortKey: 'k',
    })
  })

  it('recognises an error from another realm in a field', () => {
    const error = Object.assign(new Error('wrapper'), {
      original: runInNewContext('new RangeError("from a vm")') as unknown,
    })

    expect(withOwn(error).original).toEqual({ name: 'RangeError', message: 'from a vm' })
  })

  it('recognises an error whose class renames its string tag', () => {
    // DOMException does this: `Object.prototype.toString` then reports
    // `[object DOMException]`, so only `instanceof` still knows it is an error.
    class TaggedError extends Error {
      readonly [Symbol.toStringTag] = 'TaggedError'
    }
    const error = Object.assign(new Error('wrapper'), { original: new TaggedError('tagged') })

    expect(withOwn(error).original).toEqual({ name: 'Error', message: 'tagged' })
  })

  it('copies an error-shaped plain object as data, keeping every field', () => {
    // It passes isErrorLike, but walked as an error it would come out
    // labelled `Error` — and a response body is not one.
    const error = Object.assign(new Error('request failed'), {
      response: { message: 'Not found', status: 404 },
    })

    expect(withOwn(error).response).toEqual({ message: 'Not found', status: 404 })
  })

  it('honours maxDepth for errors held in fields', () => {
    const error = Object.assign(new Error('outer'), { original: new CorruptDeviceError('k') })

    expect('original' in withOwn(error, { maxDepth: 0 })).toBe(false)
  })

  it('terminates when errors reference each other through fields', () => {
    const a: Error & { peer?: Error } = new Error('a')
    a.peer = Object.assign(new Error('b'), { peer: a })

    const serialized = withOwn(a)

    expect(serialized).toEqual({
      name: 'Error',
      message: 'a',
      peer: { name: 'Error', message: 'b' },
    })
    expect(() => JSON.stringify(serialized)).not.toThrow()
  })

  it('keeps an error that appears in two places, since that is not a cycle', () => {
    const shared = new CorruptDeviceError('k')
    const error = Object.assign(new Error('outer', { cause: shared }), { original: shared })

    const serialized = withOwn(error)

    expect(serialized.cause?.sortKey).toBe('k')
    expect(serialized.original).toEqual(serialized.cause)
  })

  it('copies plain data as a detached, JSON-safe snapshot', () => {
    const details = { status: 404, tags: ['a', 'b'], at: new Date(0) }

    const serialized = withOwn(Object.assign(new Error('boom'), { details }))
    details.status = 500

    expect(serialized.details).toEqual({
      status: 404,
      tags: ['a', 'b'],
      at: '1970-01-01T00:00:00.000Z',
    })
  })

  it('describes values JSON cannot carry instead of throwing', () => {
    const loop: Record<string, unknown> = {}
    loop.self = loop

    const serialized = withOwn(
      Object.assign(new Error('boom'), { big: 10n, tag: Symbol('tag'), loop }),
    )

    expect(serialized).toMatchObject({ big: '10n', tag: 'Symbol(tag)', loop: '[object Object]' })
    expect(() => JSON.stringify(serialized)).not.toThrow()
  })

  it('skips functions, undefined values and getters that throw', () => {
    const error = Object.assign(new Error('boom'), {
      retry: () => undefined,
      missing: undefined,
      kept: 1,
    })
    Object.defineProperty(error, 'explodes', {
      enumerable: true,
      get: () => {
        throw new Error('getter')
      },
    })

    // Keys rather than toEqual, which would treat a `missing: undefined` as absent.
    expect(new Set(Object.keys(withOwn(error)))).toEqual(new Set(['name', 'message', 'kept']))
  })

  it('ignores non-enumerable and inherited fields', () => {
    class WithGetter extends Error {
      get computed(): number {
        return this.message.length
      }
    }
    const error = new WithGetter('boom')
    Object.defineProperty(error, 'hidden', { value: 1, enumerable: false })

    expect(new Set(Object.keys(withOwn(error)))).toEqual(new Set(['name', 'message']))
  })

  it('stores a field named __proto__ as a field rather than as the prototype', () => {
    const error = new Error('boom')
    Object.defineProperty(error, '__proto__', { value: { polluted: true }, enumerable: true })

    const serialized = withOwn(error)

    expect(Object.getPrototypeOf(serialized)).toBe(Object.prototype)
    expect(Object.getOwnPropertyDescriptor(serialized, '__proto__')?.value).toEqual({
      polluted: true,
    })
  })

  it('leaves a non-error throw as it was', () => {
    expect(withOwn('nope')).toEqual({ name: 'string', message: 'nope' })
  })
})

describe('serializeError and context', () => {
  it('copies context, so a later change on either side does not reach the other', () => {
    const context = { attempts: 1, tags: ['a'] }
    const error = new ExtendedError('boom', { context })

    const serialized = serializeError(error)
    context.tags.push('b')

    expect(serialized.context).toEqual({ attempts: 1, tags: ['a'] })

    const copy = serialized.context as { attempts: number }
    copy.attempts = 3

    expect(error.context).toEqual({ attempts: 1, tags: ['a', 'b'] })
  })

  it('writes a BigInt as a string at any depth, where JSON.stringify would throw', () => {
    const error = new ExtendedError('boom', { context: { total: 10n, page: { size: 20n } } })

    expect(serializeError(error).context).toEqual({ total: '10n', page: { size: '20n' } })
    expect(() => JSON.stringify(error)).not.toThrow()
  })

  it('describes a field JSON cannot write without losing the others', () => {
    const loop: Record<string, unknown> = {}
    loop.self = loop
    const error = new ExtendedError('boom', { context: { userId: 42, loop } })

    expect(serializeError(error).context).toEqual({ userId: 42, loop: '[object Object]' })
  })

  it('gives context JSON semantics, skipping functions, undefined and getters that throw', () => {
    const context = { at: new Date(0), missing: undefined, retry: () => undefined, kept: 1 }
    Object.defineProperty(context, 'explodes', {
      enumerable: true,
      get: () => {
        throw new Error('getter')
      },
    })

    expect(serializeError(new ExtendedError('boom', { context })).context).toStrictEqual({
      at: '1970-01-01T00:00:00.000Z',
      kept: 1,
    })
  })

  it('writes a BigInt nested in an own field as a string too', () => {
    const error = Object.assign(new Error('boom'), { page: { size: 20n } })

    expect(withOwn(error).page).toEqual({ size: '20n' })
  })
})

describe('serializeError with an AggregateError', () => {
  it('serializes its errors like causes, each with its own chain', () => {
    const error = new AggregateError(
      [new TypeError('a', { cause: new Error('a0') }), 'not an error'],
      'all failed',
    )

    expect(serializeError(error, { includeStack: false })).toEqual({
      name: 'AggregateError',
      message: 'all failed',
      errors: [
        { name: 'TypeError', message: 'a', cause: { name: 'Error', message: 'a0' } },
        { name: 'string', message: 'not an error' },
      ],
    })
  })

  it('keeps the empty list Promise.any rejects with when it is given nothing', async () => {
    const rejection: unknown = await Promise.any([]).catch((error: unknown) => error)

    expect(serializeError(rejection, { includeStack: false })).toEqual({
      name: 'AggregateError',
      message: 'All promises were rejected',
      errors: [],
    })
  })

  it('reads a subclass by instanceof, whatever its name', () => {
    class BatchError extends AggregateError {
      override readonly name = 'BatchError'
    }

    const serialized = serializeError(new BatchError([new Error('a')], 'batch failed'))

    expect(serialized.errors?.map((error) => error.message)).toEqual(['a'])
  })

  it('reads an AggregateError from another realm by its name', () => {
    const foreign: unknown = runInNewContext('new AggregateError([new Error("a")], "all failed")')

    expect(serializeError(foreign, { includeStack: false }).errors).toEqual([
      { name: 'Error', message: 'a' },
    ])
  })

  it('keeps 10 errors by default and counts the rest', () => {
    const errors = Array.from({ length: 25 }, (_, index) => new Error(`attempt ${String(index)}`))

    const serialized = serializeError(new AggregateError(errors, 'all failed'))

    expect(serialized.errors).toHaveLength(10)
    expect(serialized.errors?.[9]?.message).toBe('attempt 9')
    expect(serialized.errorsOmitted).toBe(15)
  })

  it('spends one budget across the whole output, so nesting cannot multiply it', () => {
    const inner = new AggregateError([new Error('a'), new Error('b'), new Error('c')], 'inner')
    const outer = new AggregateError([inner, new Error('d')], 'outer')

    expect(serializeError(outer, { includeStack: false, maxAggregatedErrors: 2 })).toEqual({
      name: 'AggregateError',
      message: 'outer',
      errors: [
        {
          name: 'AggregateError',
          message: 'inner',
          errors: [{ name: 'Error', message: 'a' }],
          errorsOmitted: 2,
        },
      ],
      errorsOmitted: 1,
    })
  })

  it('adds the errors cut on an earlier hop to those it cuts, and copies neither as a field', () => {
    const relayed = {
      name: 'AggregateError',
      message: 'all failed',
      errors: [
        { name: 'Error', message: 'a' },
        { name: 'Error', message: 'b' },
      ],
      errorsOmitted: 3,
    }

    expect(withOwn(relayed, { maxAggregatedErrors: 1 })).toEqual({
      name: 'AggregateError',
      message: 'all failed',
      errors: [{ name: 'Error', message: 'a' }],
      errorsOmitted: 4,
    })
  })

  it.each([
    ['a string', 'x'],
    ['a negative', -1],
    ['a fractional', 1.5],
  ])('ignores %s errorsOmitted', (_, errorsOmitted) => {
    const relayed = { name: 'AggregateError', message: 'all failed', errors: [], errorsOmitted }

    expect('errorsOmitted' in serializeError(relayed)).toBe(false)
  })

  it('stops at maxDepth as a cause does, rather than writing an empty list', () => {
    const error = new AggregateError([new Error('a')], 'all failed')

    expect('errors' in serializeError(error, { maxDepth: 0 })).toBe(false)
  })

  it('drops an AggregateError that lists itself, without spending the budget on it', () => {
    const error = new AggregateError([], 'loop')
    error.errors.push(error, new Error('a'))

    expect(serializeError(error, { includeStack: false, maxAggregatedErrors: 1 })).toEqual({
      name: 'AggregateError',
      message: 'loop',
      errors: [{ name: 'Error', message: 'a' }],
    })
  })

  it('reads errors as errors on an AggregateError only', () => {
    // Shaped like yup's ValidationError, which keeps its messages there.
    const invalid = Object.assign(new Error('invalid'), {
      name: 'ValidationError',
      errors: ['email is required'],
    })

    expect('errors' in serializeError(invalid)).toBe(false)
    expect(withOwn(invalid).errors).toEqual(['email is required'])
  })
})

describe('isErrorLike', () => {
  it('accepts anything with a string message', () => {
    expect(isErrorLike(new Error('boom'))).toBe(true)
    expect(isErrorLike({ message: 'boom' })).toBe(true)
  })

  it('rejects everything else', () => {
    expect(isErrorLike({ message: 42 })).toBe(false)
    expect(isErrorLike('boom')).toBe(false)
    expect(isErrorLike(null)).toBe(false)
    expect(isErrorLike(undefined)).toBe(false)
  })
})

describe('describeValue', () => {
  it('describes primitives readably', () => {
    expect(describeValue('boom')).toBe('boom')
    expect(describeValue(42)).toBe('42')
    expect(describeValue(true)).toBe('true')
    expect(describeValue(null)).toBe('null')
    expect(describeValue(undefined)).toBe('undefined')
    expect(describeValue(10n)).toBe('10n')
    expect(describeValue(Symbol('tag'))).toBe('Symbol(tag)')
  })

  it('serializes plain objects and arrays', () => {
    expect(describeValue({ a: 1 })).toBe('{"a":1}')
    expect(describeValue([1, 2])).toBe('[1,2]')
  })

  it('falls back when JSON.stringify cannot cope', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic

    expect(describeValue(cyclic)).toBe('[object Object]')
  })

  it('falls back when the value serializes to undefined', () => {
    // A `toJSON` returning undefined makes JSON.stringify return undefined
    // rather than a string, which would otherwise leak out as a non-string.
    expect(describeValue({ toJSON: () => undefined })).toBe('[object Object]')
  })
})

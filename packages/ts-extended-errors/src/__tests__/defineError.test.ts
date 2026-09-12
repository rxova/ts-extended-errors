import { describe, expect, expectTypeOf, it } from 'vitest'
import { findCauseOf } from '../chain'
import { defineError } from '../defineError'
import { ExtendedError, isExtendedError } from '../ExtendedError'
import { serializeError } from '../serialize'
import type { SerializedError } from '../types'

const HttpError = defineError('HttpError', { code: 'HTTP' })
const NotFoundError = defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })
const GoneError = defineError('GoneError', { base: HttpError })

describe('defineError', () => {
  it('produces a class whose instances are real errors', () => {
    const error = new HttpError('bad gateway')

    expect(error).toBeInstanceOf(HttpError)
    expect(error).toBeInstanceOf(ExtendedError)
    expect(error).toBeInstanceOf(Error)
  })

  it('names the class, rather than leaving the internal binding name', () => {
    expect(HttpError.name).toBe('HttpError')
    expect(new HttpError('boom').name).toBe('HttpError')
  })

  it('keeps the base class in the prototype chain', () => {
    const error = new NotFoundError('no such user')

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toBeInstanceOf(HttpError)
    expect(error).toBeInstanceOf(ExtendedError)
    expect(error.name).toBe('NotFoundError')
  })

  it('assigns the declared code', () => {
    expect(new NotFoundError('boom').code).toBe('HTTP_NOT_FOUND')
  })

  it("inherits the base's code when none is declared", () => {
    expect(GoneError.code).toBe('HTTP')
    expect(new GoneError('boom').code).toBe('HTTP')
  })

  it('leaves code undefined when neither the class nor its base declares one', () => {
    const Plain = defineError('PlainError')

    expect(Plain.code).toBeUndefined()
    expect(new Plain('boom').code).toBeUndefined()
  })

  it('carries context and cause like any other ExtendedError', () => {
    const cause = new Error('socket hang up')
    const error = new NotFoundError('no such user', { context: { id: 7 }, cause })

    expect(error.context).toEqual({ id: 7 })
    expect(error.cause).toBe(cause)
  })

  it('can be subclassed with the class syntax too', () => {
    class TeapotError extends HttpError {}

    const error = new TeapotError('I am a teapot')

    expect(error).toBeInstanceOf(HttpError)
    expect(error.name).toBe('TeapotError')
    expect(error.code).toBe('HTTP')
  })

  it('keeps sibling classes apart', () => {
    expect(new NotFoundError('no such user')).not.toBeInstanceOf(GoneError)
    expect(new GoneError('gone')).not.toBeInstanceOf(NotFoundError)
  })

  it('starts the stack at the throw site, under the defined name', () => {
    const error = new NotFoundError('no such user')

    expect(error.stack?.split('\n')[0]).toBe('NotFoundError: no such user')
    expect(error.stack).not.toContain('at new ExtendedError')
  })

  it('serializes with its own name and code', () => {
    expect(serializeError(new NotFoundError('no such user'), { includeStack: false })).toEqual({
      name: 'NotFoundError',
      message: 'no such user',
      code: 'HTTP_NOT_FOUND',
    })
  })

  it('types context from its parameter', () => {
    const ParseError = defineError<{ line: number }>('ParseError')

    expectTypeOf(new ParseError('bad token', { context: { line: 3 } }).context).toEqualTypeOf<
      { line: number } | undefined
    >()
  })
})

const OutOfRangeError = defineError('OutOfRangeError', { base: RangeError, code: 'OUT_OF_RANGE' })

const builtIns = [Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError]

describe('defineError on a class other than ExtendedError', () => {
  it('extends the base it was given', () => {
    const error = new OutOfRangeError('page 0 does not exist')

    expect(error).toBeInstanceOf(OutOfRangeError)
    expect(error).toBeInstanceOf(RangeError)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('page 0 does not exist')
  })

  it('is not an ExtendedError, since a class has one parent', () => {
    const error = new OutOfRangeError('page 0')

    expect(error).not.toBeInstanceOf(ExtendedError)
    expect(isExtendedError(error)).toBe(false)
  })

  it.each(builtIns.map((Base) => [Base.name, Base] as const))('accepts %s', (_, Base) => {
    const Defined = defineError('DefinedError', { base: Base, code: 'DEFINED' })

    const error = new Defined('boom')

    expect(error).toBeInstanceOf(Base)
    expect(error.name).toBe('DefinedError')
    expect(error.code).toBe('DEFINED')
    expect(error.message).toBe('boom')
  })

  it('accepts an error class of your own, keeping what it adds', () => {
    class LegacyError extends Error {
      readonly legacy = true
    }
    const WrappedError = defineError('WrappedError', { base: LegacyError })

    const error = new WrappedError('boom')

    expect(error).toBeInstanceOf(LegacyError)
    expect(error.legacy).toBe(true)
    expect(error.code).toBeUndefined()
  })

  it('takes its name from the constructed class, including a subclass', () => {
    class PageError extends OutOfRangeError {}

    expect(OutOfRangeError.name).toBe('OutOfRangeError')
    expect(new OutOfRangeError('x').name).toBe('OutOfRangeError')
    expect(new PageError('x').name).toBe('PageError')
    expect(new PageError('x').code).toBe('OUT_OF_RANGE')
  })

  it('copies the static code onto the instance, and leaves it undefined when there is none', () => {
    const Plain = defineError('PlainError', { base: RangeError })

    expect(OutOfRangeError.code).toBe('OUT_OF_RANGE')
    expect(new OutOfRangeError('x').code).toBe('OUT_OF_RANGE')
    expect(Plain.code).toBeUndefined()
    expect(new Plain('x').code).toBeUndefined()
  })

  it('inherits the code of a base defined the same way', () => {
    const PageError = defineError('PageError', { base: OutOfRangeError })

    const error = new PageError('page 0')

    expect(PageError.code).toBe('OUT_OF_RANGE')
    expect(error).toBeInstanceOf(OutOfRangeError)
    expect(error).toBeInstanceOf(RangeError)
    expect(error.name).toBe('PageError')
    expect(error.code).toBe('OUT_OF_RANGE')
  })

  it('ignores a static code on the base that is not a string', () => {
    class NumberedError extends Error {
      static readonly code = 42
    }

    expect(defineError('Defined', { base: NumberedError }).code).toBeUndefined()
  })

  it('carries context and forwards cause', () => {
    const cause = new Error('inner')
    const error = new OutOfRangeError('page 0', { context: { page: 0 }, cause })

    expect(error.context).toEqual({ page: 0 })
    expect(error.cause).toBe(cause)
  })

  it('does not define cause when none was passed', () => {
    expect('cause' in new OutOfRangeError('page 0')).toBe(false)
    expect('cause' in new OutOfRangeError('page 0', { cause: undefined })).toBe(true)
  })

  it('starts the stack at the throw site, under the defined name', () => {
    const lines = new OutOfRangeError('page 0').stack?.split('\n') ?? []

    expect(lines[0]).toBe('OutOfRangeError: page 0')
    expect(lines[1]).toContain('defineError.test.ts')
  })

  it('constructs on an engine without captureStackTrace', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Error, 'captureStackTrace')
    Reflect.deleteProperty(Error, 'captureStackTrace')

    try {
      const error = new OutOfRangeError('page 0')

      expect(error.name).toBe('OutOfRangeError')
      expect(error.stack).toBeTypeOf('string')
    } finally {
      if (descriptor) Object.defineProperty(Error, 'captureStackTrace', descriptor)
    }
  })

  it('restores the prototype when the base constructor hands back a fresh object', () => {
    // What a base compiled down to ES5 does: `super()` returns a plain Error.
    class FreshError extends Error {
      constructor(message?: string, options?: ErrorOptions) {
        super(message, options)
        return new Error(message, options)
      }
    }
    const Defined = defineError('Defined', { base: FreshError })

    expect(new Defined('boom')).toBeInstanceOf(Defined)
  })

  it('serializes like an ExtendedError', () => {
    const error = new OutOfRangeError('page 0', {
      context: { page: 0 },
      cause: new Error('inner'),
    })

    expect(JSON.parse(JSON.stringify(error))).toMatchObject({
      name: 'OutOfRangeError',
      message: 'page 0',
      code: 'OUT_OF_RANGE',
      context: { page: 0 },
      cause: { name: 'Error', message: 'inner' },
    })
    expect(error.toJSON()).toEqual(serializeError(error))
  })

  it('is found down a cause chain by its own class and by its base', () => {
    const error = new ExtendedError('request failed', { cause: new OutOfRangeError('page 0') })

    expect(findCauseOf(error, OutOfRangeError)?.code).toBe('OUT_OF_RANGE')
    expect(findCauseOf(error, RangeError)?.message).toBe('page 0')
  })

  it('types instances as the base plus the extended fields', () => {
    const error = new OutOfRangeError('page 0')

    expectTypeOf(error).toExtend<RangeError>()
    expectTypeOf(error.code).toEqualTypeOf<string | undefined>()
    expectTypeOf(error.toJSON()).toEqualTypeOf<SerializedError>()

    const PageError = defineError<{ page: number }, RangeError>('PageError', { base: RangeError })
    expectTypeOf(new PageError('page 0', { context: { page: 0 } }).context).toEqualTypeOf<
      { page: number } | undefined
    >()
  })

  it('refuses a base whose constructor does not take a message', () => {
    class StatusError extends Error {
      constructor(status: number) {
        super(String(status))
      }
    }

    // @ts-expect-error: the base must take `(message, options)`
    const Defined = defineError('Defined', { base: StatusError })
    expect(Defined).toBeTypeOf('function')
  })
})

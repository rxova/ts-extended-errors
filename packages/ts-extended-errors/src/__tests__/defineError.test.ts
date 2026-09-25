import { describe, expect, expectTypeOf, it } from 'vitest'
import { findCauseOf } from '../chain'
import { defineError, type ErrorClass, type ExtendedErrorConstructor } from '../defineError'
import { deserializeError } from '../deserialize'
import { ExtendedError, isExtendedError } from '../ExtendedError'
import { serializeError } from '../serialize'
import type { ErrorContext, SerializedError } from '../types'

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

  it('types context as present when the throw site has to pass one', () => {
    const error = new InvalidDateError({ context: { value: '2026-02-30' } })

    // The point of the issue: `context` is required at every throw site, so
    // reading a field off it should not need `?.` and a `??` for a branch that
    // cannot be taken.
    expectTypeOf(error.context).toEqualTypeOf<{ value: string }>()
    expect(error.context.value).toBe('2026-02-30')
  })

  it('leaves context optional when the class can be constructed without one', () => {
    // `ConfigMissingError`'s message takes no context, so nothing requires one
    // and an instance really can have none. Narrowing here would be a lie.
    expectTypeOf(new ConfigMissingError().context).toEqualTypeOf<ErrorContext | undefined>()

    const DiskError = defineError('DiskError', {
      message: (context: { detail?: string }) => context.detail ?? 'disk error',
    })

    expectTypeOf(new DiskError().context).toEqualTypeOf<{ detail?: string } | undefined>()
    expect(new DiskError().context).toBeUndefined()
  })

  it('keeps context present through the (message, options) overload', () => {
    // The overload `deserializeError` rebuilds through. It cannot require a
    // context without ceasing to be an `ErrorClass`, so it defaults one — the
    // instance type promises a context, and this is what keeps that true.
    const error = new InvalidDateError('sent from elsewhere')

    expectTypeOf(error.context).toEqualTypeOf<{ value: string }>()
    expect(error.context).toEqual({})
    expect(error.message).toBe('sent from elsewhere')
    expect('cause' in error).toBe(false)
  })

  it('narrows context on a class defined on a built-in base too', () => {
    const PageError = defineError('PageError', {
      base: RangeError,
      message: (context: { page: number }) => `page ${String(context.page)} does not exist`,
    })

    const error = new PageError({ context: { page: 0 } })

    expectTypeOf(error.context).toEqualTypeOf<{ page: number }>()
    expect(error.context.page).toBe(0)
    expect(error).toBeInstanceOf(RangeError)
  })

  it('stays an ErrorClass, so deserializeError can rebuild it', () => {
    // Narrowing the instance must not cost the `(message, options)` signature:
    // `classes` takes `ErrorClass`, and a class that no longer matched it would
    // be a type error at every call site that lists one.
    const classes: ErrorClass[] = [InvalidDateError, ConfigMissingError]
    const rebuilt = deserializeError(
      { name: 'InvalidDateError', message: '"x" is not a valid date', context: { value: 'x' } },
      { classes },
    )

    expect(rebuilt).toBeInstanceOf(InvalidDateError)
    expect((rebuilt as InstanceType<typeof InvalidDateError>).context).toEqual({ value: 'x' })
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

  it('types code as the literal the class declares, on the class and its instances', () => {
    expectTypeOf(NotFoundError.code).toEqualTypeOf<'HTTP_NOT_FOUND'>()
    expectTypeOf(new NotFoundError('boom').code).toEqualTypeOf<'HTTP_NOT_FOUND'>()
    expectTypeOf(findCauseOf(null, NotFoundError)?.code).toEqualTypeOf<
      'HTTP_NOT_FOUND' | undefined
    >()

    // Which is what makes a switch over codes exhaustive.
    const describe = (
      error: InstanceType<typeof HttpError> | InstanceType<typeof NotFoundError>,
    ) => {
      switch (error.code) {
        case 'HTTP':
          return 'http'
        case 'HTTP_NOT_FOUND':
          return 'not found'
      }
    }
    expectTypeOf(describe).returns.toEqualTypeOf<'http' | 'not found'>()
    expect(describe(new NotFoundError('boom'))).toBe('not found')
  })

  it("types an inherited code as the base's literal", () => {
    expectTypeOf(GoneError.code).toEqualTypeOf<'HTTP'>()
    expectTypeOf(new GoneError('boom').code).toEqualTypeOf<'HTTP'>()
  })

  it('types code as string | undefined when nothing declares one', () => {
    const Plain = defineError('PlainError')

    expectTypeOf(Plain.code).toEqualTypeOf<string | undefined>()
    expectTypeOf(new Plain('boom').code).toEqualTypeOf<string | undefined>()
  })

  it('types a code that was a variable as what the variable was', () => {
    const fromString = 'FROM_STRING' as string
    const maybe = undefined as string | undefined

    // A `string | undefined` infers as `string`, the way any optional property
    // does; what the runtime does is `code ?? base.code`.
    expectTypeOf(
      defineError('A', { base: HttpError, code: fromString }).code,
    ).toEqualTypeOf<string>()
    expectTypeOf(defineError('B', { base: HttpError, code: maybe }).code).toEqualTypeOf<string>()
    expect(defineError('B', { base: HttpError, code: maybe }).code).toBe('HTTP')
  })

  it('widens code to string | undefined when the context is given as a type argument', () => {
    // TypeScript infers all of a call's type arguments or none, so an explicit
    // `Context` leaves `Code` at its default. Name `Code` too to keep the literal.
    const Loose = defineError<{ retryAfter: number }>('Loose', { base: HttpError, code: 'RATE' })
    const Exact = defineError<{ retryAfter: number }, 'RATE'>('Exact', { code: 'RATE' })

    expectTypeOf(Loose.code).toEqualTypeOf<string | undefined>()
    expect(Loose.code).toBe('RATE')
    expectTypeOf(Exact.code).toEqualTypeOf<'RATE'>()
  })

  it('refuses a class-syntax subclass that declares a different code', () => {
    // The instance type of a subclass is fixed by its base, so a static `code`
    // that differs from the base's literal would make the instances lie.
    // Define the leaf with `defineError` instead, and extend that.
    // @ts-expect-error: 'TEAPOT' is not 'HTTP'
    class TeapotError extends HttpError {
      static override readonly code = 'TEAPOT'
    }
    class BrewingError extends defineError('BrewingError', { base: HttpError, code: 'BREWING' }) {
      readonly retryAfter = 30
    }

    expect(new TeapotError('boom').code).toBe('TEAPOT')
    expectTypeOf(new BrewingError('boom').code).toEqualTypeOf<'BREWING'>()
    expect(new BrewingError('boom').retryAfter).toBe(30)
  })

  it('accepts an interface as the context type', () => {
    // An interface has no index signature, so a `Record<string, unknown>`
    // constraint refused every context declared with one. `object` does not.
    interface UserContext {
      userId: number
    }
    const UserError = defineError<UserContext>('UserError')
    const NoUserError = defineError('NoUserError', {
      message: (context: UserContext) => `no user ${String(context.userId)}`,
    })

    expectTypeOf(new UserError('boom', { context: { userId: 7 } }).context).toEqualTypeOf<
      UserContext | undefined
    >()
    expectTypeOf(new NoUserError({ context: { userId: 7 } }).context).toEqualTypeOf<UserContext>()
    expect(new NoUserError({ context: { userId: 7 } }).message).toBe('no user 7')
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

  it('defines code and context only when there is one', () => {
    const Plain = defineError('PlainError', { base: RangeError })

    expect(Object.keys(new Plain('x'))).toEqual(['name'])
    expect(Object.keys(new OutOfRangeError('x', { context: { page: 0 } }))).toEqual([
      'name',
      'code',
      'context',
    ])
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
    expectTypeOf(error.code).toEqualTypeOf<'OUT_OF_RANGE'>()
    expectTypeOf(new (defineError('Plain', { base: RangeError }))('x').code).toEqualTypeOf<
      string | undefined
    >()
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

const InvalidDateError = defineError('InvalidDateError', {
  code: 'INVALID_DATE',
  message: (context: { value: string }) => `"${context.value}" is not a valid date`,
})
const ConfigMissingError = defineError('ConfigMissingError', {
  message: () => 'no config file found',
})

describe('defineError with a message', () => {
  it('writes the message from the context', () => {
    const error = new InvalidDateError({ context: { value: '2026-02-30' } })

    expect(error.message).toBe('"2026-02-30" is not a valid date')
    expect(error.context).toEqual({ value: '2026-02-30' })
    expect(error.code).toBe('INVALID_DATE')
    expect(error.name).toBe('InvalidDateError')
    expect(InvalidDateError.name).toBe('InvalidDateError')
    expect(error).toBeInstanceOf(InvalidDateError)
    expect(error).toBeInstanceOf(ExtendedError)
  })

  it('forwards cause, and defines it only when one was passed', () => {
    const cause = new Error('inner')

    expect(new InvalidDateError({ context: { value: 'x' }, cause }).cause).toBe(cause)
    expect('cause' in new InvalidDateError({ context: { value: 'x' } })).toBe(false)
  })

  it('takes no arguments when the context has no required fields', () => {
    expect(new ConfigMissingError().message).toBe('no config file found')
    expect(new ConfigMissingError().context).toBeUndefined()
    expect(new ConfigMissingError({ cause: 'ENOENT' }).cause).toBe('ENOENT')
  })

  it('passes an empty context to the message when none was given', () => {
    const DiskError = defineError('DiskError', {
      message: (context: { detail?: string }) => context.detail ?? 'disk error',
    })

    expect(new DiskError().message).toBe('disk error')
    expect(new DiskError({ context: { detail: 'disk full' } }).message).toBe('disk full')
  })

  it('takes a string first argument as the message itself', () => {
    const error = new InvalidDateError('custom', { context: { value: 'x' } })

    expect(error.message).toBe('custom')
    expect(error.context).toEqual({ value: 'x' })
  })

  it('extends a base defined with defineError', () => {
    const RetryError = defineError('RetryError', {
      base: HttpError,
      message: (context: { attempts: number }) =>
        `gave up after ${String(context.attempts)} attempts`,
    })

    const error = new RetryError({ context: { attempts: 3 } })

    expect(error).toBeInstanceOf(HttpError)
    expect(error.code).toBe('HTTP')
    expect(error.message).toBe('gave up after 3 attempts')
  })

  it('extends a built-in class', () => {
    const PageError = defineError('PageError', {
      base: RangeError,
      code: 'PAGE',
      message: (context: { page: number }) => `page ${String(context.page)} does not exist`,
    })

    const error = new PageError({ context: { page: 0 } })

    expect(error).toBeInstanceOf(RangeError)
    expect(error).not.toBeInstanceOf(ExtendedError)
    expect(error.message).toBe('page 0 does not exist')
    expect(error.code).toBe('PAGE')
    expect(error.context).toEqual({ page: 0 })
    expect(error.stack?.split('\n')[0]).toBe('PageError: page 0 does not exist')
  })

  it('keeps writing the message in a subclass', () => {
    class PastDateError extends InvalidDateError {}

    const error = new PastDateError({ context: { value: '1999-01-01' } })

    expect(error.name).toBe('PastDateError')
    expect(error.message).toBe('"1999-01-01" is not a valid date')
    expect(error).toBeInstanceOf(InvalidDateError)
  })

  it('takes the context type from the type parameter instead', () => {
    const NotADateError = defineError<{ value: string }>('NotADateError', {
      message: ({ value }) => `not a date: ${value}`,
    })

    expect(new NotADateError({ context: { value: 'x' } }).message).toBe('not a date: x')
  })

  it('falls back to the class name when the message throws', () => {
    const TotalError = defineError('TotalError', {
      message: (context: { total: bigint }) => `total: ${JSON.stringify(context.total)}`,
    })
    class GrandTotalError extends TotalError {}

    const error = new TotalError({ context: { total: 10n } })

    expect(error).toBeInstanceOf(TotalError)
    expect(error.message).toBe('TotalError')
    expect(error.context).toEqual({ total: 10n })
    expect(new GrandTotalError({ context: { total: 10n } }).message).toBe('GrandTotalError')
  })

  it('is inherited by a class defined on it without a message', () => {
    const PastDateError = defineError('PastDateError', { base: InvalidDateError })

    const error = new PastDateError({ context: { value: '1999-01-01' } })

    expect(error.message).toBe('"1999-01-01" is not a valid date')
    expect(error.name).toBe('PastDateError')
    expect(error.code).toBe('INVALID_DATE')
    expect(error).toBeInstanceOf(InvalidDateError)
    // Required at the call site, so present on the instance — the base's
    // guarantee is inherited along with its message.
    expectTypeOf(error.context).toEqualTypeOf<{ value: string }>()

    // @ts-expect-error: `value` is required, as it is for the base
    const withoutContext = () => new PastDateError()
    expect(withoutContext).toBeTypeOf('function')
  })

  it('leaves the type of classes defined without a message as it was', () => {
    expectTypeOf(defineError('Plain')).toEqualTypeOf<ExtendedErrorConstructor>()
    expectTypeOf(defineError('Leaf', { base: HttpError })).toEqualTypeOf<
      ExtendedErrorConstructor<ErrorContext, ExtendedError, 'HTTP'>
    >()
  })

  it('lets a class defined on it write its own message', () => {
    const PastDateError = defineError('PastDateError', {
      base: InvalidDateError,
      message: (context: { value: string }) => `${context.value} is in the past`,
    })

    const error = new PastDateError({ context: { value: '1999-01-01' } })

    expect(error.message).toBe('1999-01-01 is in the past')
    expect(error.code).toBe('INVALID_DATE')
    expect(error).toBeInstanceOf(InvalidDateError)
  })

  it('starts the stack at the throw site, under the defined name', () => {
    const lines = new InvalidDateError({ context: { value: 'x' } }).stack?.split('\n') ?? []

    expect(lines[0]).toBe('InvalidDateError: "x" is not a valid date')
    expect(lines[1]).toContain('defineError.test.ts')
  })

  it('is rebuilt by deserializeError with the message it was sent with', () => {
    const ExpiredError = defineError('ExpiredError', {
      message: (context: { at: Date }) => `expired at ${context.at.toISOString()}`,
    })
    // `at` arrives as a string, so formatting the message again would throw.
    const payload = JSON.parse(
      JSON.stringify(new ExpiredError({ context: { at: new Date(0) } })),
    ) as unknown

    const rebuilt = deserializeError(payload, { classes: [ExpiredError] })

    expect(rebuilt).toBeInstanceOf(ExpiredError)
    expect(rebuilt.message).toBe('expired at 1970-01-01T00:00:00.000Z')
  })

  it('is found down a cause chain', () => {
    const error = new ExtendedError('import failed', {
      cause: new InvalidDateError({ context: { value: 'x' } }),
    })

    // One `?.` for "was it found", and none for the context: the class requires
    // one at every throw site, so the instance has one.
    expect(findCauseOf(error, InvalidDateError)?.context.value).toBe('x')
  })

  it('types code as the literal declared next to message', () => {
    expectTypeOf(InvalidDateError.code).toEqualTypeOf<'INVALID_DATE'>()
    expectTypeOf(
      new InvalidDateError({ context: { value: 'x' } }).code,
    ).toEqualTypeOf<'INVALID_DATE'>()
    expectTypeOf(new ConfigMissingError().code).toEqualTypeOf<string | undefined>()
    expectTypeOf(
      defineError('PastDateError', { base: InvalidDateError }).code,
    ).toEqualTypeOf<'INVALID_DATE'>()
  })

  it('types context from the parameter of message, and requires it when it has required fields', () => {
    expectTypeOf(new InvalidDateError({ context: { value: 'x' } }).context).toEqualTypeOf<{
      value: string
    }>()

    // @ts-expect-error: `value` is required
    const withoutContext = () => new InvalidDateError()
    // @ts-expect-error: `value` is a string
    const wrongContext = () => new InvalidDateError({ context: { value: 1 } })

    expect(withoutContext).toBeTypeOf('function')
    expect(wrongContext).toBeTypeOf('function')
  })
})

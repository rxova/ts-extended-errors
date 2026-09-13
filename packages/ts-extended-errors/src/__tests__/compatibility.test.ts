import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  ExtendedError,
  defineError,
  deserializeError,
  findCause,
  findCauseOf,
  isExtendedError,
  serializeError,
  toError,
} from '../index'
import type * as Library from '../index'

// The receiver's error classes. The payloads below are what other senders —
// earlier and later releases of the same application, or another service
// entirely — put on the wire.
const HttpError = defineError('HttpError', { code: 'HTTP' })
const NotFoundError = defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })

const classes = [HttpError, NotFoundError]

const overTheWire = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

const expectInstance = <T>(value: unknown, Class: abstract new (...args: never[]) => T): T => {
  expect(value).toBeInstanceOf(Class)
  return value as T
}

/**
 * The line the README's minimal example prints. Receivers already parse it, so
 * a change to it is a breaking change to the wire format, not a refactor.
 */
const README_LINE =
  '{"name":"HttpError","message":"loading the profile failed","code":"HTTP","cause":' +
  '{"name":"NotFoundError","message":"no such user","code":"HTTP_NOT_FOUND","context":{"userId":42}}}'

describe('the wire format', () => {
  it('is still the line the README documents', () => {
    const error = new HttpError('loading the profile failed', {
      cause: new NotFoundError('no such user', { context: { userId: 42 } }),
    })

    expect(JSON.stringify(serializeError(error, { includeStack: false }))).toBe(README_LINE)
  })

  it('reads that line back and writes it again unchanged', () => {
    const back = deserializeError(JSON.parse(README_LINE), { classes })

    expect(back).toBeInstanceOf(HttpError)
    expect(findCauseOf(back, NotFoundError)?.context).toEqual({ userId: 42 })
    expect(JSON.stringify(serializeError(back))).toBe(README_LINE)
  })
})

describe('a payload from an older sender', () => {
  it('rebuilds a payload with no code, stack or context, filling in the class code', () => {
    const back = expectInstance(
      deserializeError({ name: 'NotFoundError', message: 'no such user' }, { classes }),
      NotFoundError,
    )

    expect(back.code).toBe('HTTP_NOT_FOUND')
    expect(back.context).toBeUndefined()
    expect(back.stack).toBeUndefined()
    expect('cause' in back).toBe(false)
  })

  it('keeps the code the sender wrote over the one the receiver class declares', () => {
    // The code was renamed between releases; the payload says what happened.
    const back = expectInstance(
      deserializeError(
        { name: 'NotFoundError', message: 'gone', code: 'E_NOT_FOUND' },
        { classes },
      ),
      NotFoundError,
    )

    expect(back.code).toBe('E_NOT_FOUND')
  })

  it('rebuilds a class the receiver has since renamed, through an alias', () => {
    // An earlier release threw UserMissingError; this one calls it NotFoundError.
    const UserMissingError = defineError('UserMissingError', { base: NotFoundError })

    const back = deserializeError(
      { name: 'UserMissingError', message: 'no such user', context: { userId: 42 } },
      { classes: [...classes, UserMissingError] },
    )

    expect(findCauseOf(back, NotFoundError)?.context).toEqual({ userId: 42 })
    expect(back.name).toBe('UserMissingError')
  })
})

describe('a payload from a newer sender', () => {
  const fromNewerSender = {
    name: 'NotFoundError',
    message: 'no such user',
    code: 'HTTP_NOT_FOUND',
    context: { userId: 42 },
    retryable: false,
    cause: {
      name: 'ShardUnavailableError',
      message: 'shard 7 is down',
      code: 'DB_SHARD',
      shard: 7,
    },
  }

  it('keeps a class the receiver does not know as an ExtendedError with its name and code', () => {
    const back = deserializeError(overTheWire(fromNewerSender), { classes })

    const shard = expectInstance(back.cause, ExtendedError)
    expect(shard.name).toBe('ShardUnavailableError')
    expect(shard.code).toBe('DB_SHARD')
    // `instanceof` cannot match a class the receiver lacks; the code still can.
    expect(findCause(back, (error) => isExtendedError(error) && error.code === 'DB_SHARD')).toBe(
      shard,
    )
  })

  it('does not place an unknown class in a known family', () => {
    const back = deserializeError(
      { name: 'GoneError', message: 'gone', code: 'HTTP_GONE' },
      { classes },
    )

    expect(back).not.toBeInstanceOf(HttpError)
    expect(back).toBeInstanceOf(ExtendedError)
  })

  it('keeps fields the receiver does not know, down the chain', () => {
    const back = deserializeError(overTheWire(fromNewerSender), { classes })

    expect(Reflect.get(back, 'retryable')).toBe(false)
    expect(Reflect.get(back.cause as Error, 'shard')).toBe(7)
  })

  it('forwards those fields unchanged through a relay that asks for own fields', () => {
    const back = deserializeError(overTheWire(fromNewerSender), { classes })

    expect(serializeError(back, { includeOwnProperties: true })).toEqual(fromNewerSender)
  })

  it('drops those fields at a relay that does not', () => {
    const relayed = serializeError(deserializeError(overTheWire(fromNewerSender), { classes }))

    expect('retryable' in relayed).toBe(false)
    expect(relayed.cause).toEqual({
      name: 'ShardUnavailableError',
      message: 'shard 7 is down',
      code: 'DB_SHARD',
    })
  })

  it('passes context through as sent, without checking it against the receiver type', () => {
    const TypedNotFoundError = defineError<{ userId: number }>('NotFoundError')

    const back = expectInstance(
      deserializeError(
        { name: 'NotFoundError', message: 'no such user', context: { userId: '42', tenant: 'a' } },
        { classes: [TypedNotFoundError] },
      ),
      TypedNotFoundError,
    )

    expect(back.context).toEqual({ userId: '42', tenant: 'a' })
  })
})

describe('two copies of the library in one process', () => {
  // A dependency bundling another release, or the ESM and CommonJS builds both
  // loaded: two module instances, so two ExtendedError classes.
  let other: typeof Library

  beforeAll(async () => {
    vi.resetModules()
    other = await import('../index')
  })

  const fromOtherCopy = () => {
    const OtherHttpError = other.defineError('HttpError', { code: 'HTTP' })
    const OtherNotFoundError = other.defineError('NotFoundError', {
      base: OtherHttpError,
      code: 'HTTP_NOT_FOUND',
    })
    return new OtherHttpError('loading the profile failed', {
      cause: new OtherNotFoundError('no such user', { context: { userId: 42 } }),
    })
  }

  it('are distinct classes, so instanceof does not cross between them', () => {
    const error = fromOtherCopy()

    expect(other.ExtendedError).not.toBe(ExtendedError)
    expect(error).toBeInstanceOf(Error)
    expect(isExtendedError(error)).toBe(false)
    expect(findCauseOf(error, NotFoundError)).toBeUndefined()
  })

  it('read each other’s errors completely', () => {
    const error = fromOtherCopy()

    expect(serializeError(error)).toEqual(other.serializeError(error))
    expect(JSON.stringify(serializeError(error, { includeStack: false }))).toBe(README_LINE)
    expect(toError(error)).toBe(error)
  })

  it('cross between copies through the wire format', () => {
    const error = fromOtherCopy()

    const back = deserializeError(serializeError(error), { classes })

    expect(back).toBeInstanceOf(HttpError)
    expect(findCauseOf(back, NotFoundError)?.context).toEqual({ userId: 42 })
    expect(back.stack).toBe(error.stack)
  })

  it('cross the other way as well', () => {
    const error = new NotFoundError('no such user')

    const back = other.deserializeError(serializeError(error))

    expect(back).toBeInstanceOf(other.ExtendedError)
    expect(back).not.toBeInstanceOf(ExtendedError)
    expect(back.name).toBe('NotFoundError')
    expect(Reflect.get(back, 'code')).toBe('HTTP_NOT_FOUND')
  })
})

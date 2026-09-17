import { describe, expect, it } from 'vitest'
import { causeChain, findCause, findCauseOf, rootCause } from '../chain'
import { deserializeError } from '../deserialize'
import { ExtendedError, isExtendedError } from '../ExtendedError'
import { describeValue, isErrorLike, serializeError } from '../serialize'
import { toError } from '../toError'

const revokedProxy = <Target extends object>(target: Target): Target => {
  const { proxy, revoke } = Proxy.revocable(target, {})
  revoke()
  return proxy
}

const throwingGetter = (target: object, key: PropertyKey): void => {
  Object.defineProperty(target, key, {
    enumerable: true,
    get: () => {
      throw new Error(`${String(key)} getter`)
    },
  })
}

describe('hostile values', () => {
  it('reads an error-shaped message only once', () => {
    let serializationReads = 0
    const serializable = {
      name: 'TransientError',
      get message() {
        serializationReads += 1
        if (serializationReads > 1) throw new Error('message read twice')
        return 'boom'
      },
    }

    expect(serializeError(serializable, { includeStack: false })).toEqual({
      name: 'TransientError',
      message: 'boom',
    })
    expect(serializationReads).toBe(1)

    let deserializationReads = 0
    const payload = {
      name: 'Error',
      get message() {
        deserializationReads += 1
        if (deserializationReads > 1) throw new Error('message read twice')
        return 'boom'
      },
    }

    expect(deserializeError(payload).message).toBe('boom')
    expect(deserializationReads).toBe(1)
  })

  it('treats throwing optional getters as absent', () => {
    const value: Record<string, unknown> = { message: 'boom' }
    for (const key of ['name', 'code', 'stack', 'context', 'cause']) throwingGetter(value, key)

    expect(serializeError(value)).toEqual({ name: 'Error', message: 'boom' })

    const normalized = toError(value)
    expect(normalized.name).toBe('ExtendedError')
    expect(normalized.message).toBe('boom')
    expect(normalized.stack).toBeTypeOf('string')
  })

  it('falls back for a revoked proxy instead of throwing while inspecting it', () => {
    const value = revokedProxy({ message: 'unreachable' })

    expect(isErrorLike(value)).toBe(false)
    expect(isExtendedError(value)).toBe(false)
    expect(describeValue(value)).toBe('<uninspectable object>')
    expect(serializeError(value)).toEqual({
      name: 'object',
      message: '<uninspectable object>',
    })
    expect(toError(value).message).toBe('<uninspectable object>')
    expect(deserializeError(value).message).toBe('<uninspectable object>')
  })

  it('falls back when neither JSON nor the string tag can describe an object', () => {
    const value = { toJSON: () => undefined }
    throwingGetter(value, Symbol.toStringTag)

    expect(describeValue(value)).toBe('<uninspectable object>')
  })

  it('keeps the fixed fields when a proxy refuses key enumeration', () => {
    const value = new Proxy(
      { name: 'RemoteError', message: 'boom', extra: 1 },
      {
        ownKeys: () => {
          throw new Error('ownKeys')
        },
      },
    )

    expect(serializeError(value, { includeStack: false, includeOwnProperties: true })).toEqual({
      name: 'RemoteError',
      message: 'boom',
    })

    const rebuilt = deserializeError(value)
    expect(rebuilt.name).toBe('RemoteError')
    expect(Reflect.has(rebuilt, 'extra')).toBe(false)
  })

  it('omits an inaccessible cause when deserializing', () => {
    const value = new Proxy(
      { name: 'Error', message: 'outer', cause: { name: 'Error', message: 'inner' } },
      {
        has: () => {
          throw new Error('has')
        },
      },
    )

    expect('cause' in deserializeError(value)).toBe(false)

    const throwingCause: Record<string, unknown> = { name: 'Error', message: 'outer' }
    throwingGetter(throwingCause, 'cause')
    expect('cause' in deserializeError(throwingCause)).toBe(false)

    const dataCause = { status: 500 }
    expect(deserializeError({ name: 'Error', message: 'outer', cause: dataCause }).cause).toBe(
      dataCause,
    )
  })

  it('skips an own field whose getter throws when deserializing', () => {
    const value: Record<string, unknown> = { name: 'Error', message: 'boom' }
    throwingGetter(value, 'extra')

    expect(Reflect.has(deserializeError(value), 'extra')).toBe(false)
  })

  it('omits an AggregateError list that cannot be inspected', () => {
    const errors = revokedProxy([new Error('inner')])
    const value = { name: 'AggregateError', message: 'all failed', errors }

    expect(serializeError(value, { includeStack: false })).toEqual({
      name: 'AggregateError',
      message: 'all failed',
    })

    const rebuilt = deserializeError(value)
    expect(rebuilt).toBeInstanceOf(ExtendedError)
    expect(rebuilt.name).toBe('AggregateError')
  })

  it('stops a cause chain when reading cause throws', () => {
    const value = { message: 'outer' }
    throwingGetter(value, 'cause')

    expect(causeChain(value)).toEqual([value])
    expect(rootCause(value)).toBe(value)
    expect(serializeError(value, { includeStack: false })).toEqual({
      name: 'Error',
      message: 'outer',
    })
  })

  it('treats a throwing instanceof check as no match', () => {
    class HostileClass {
      readonly marker = true

      static [Symbol.hasInstance](): boolean {
        throw new Error('hasInstance')
      }
    }

    const value = revokedProxy({})
    expect(findCauseOf(value, Error)).toBeUndefined()
    expect(findCauseOf({}, HostileClass)).toBeUndefined()
  })

  it('does not swallow an exception from a caller-provided predicate', () => {
    const failure = new Error('predicate')

    expect(() =>
      findCause(new Error('boom'), () => {
        throw failure
      }),
    ).toThrow(failure)
  })
})

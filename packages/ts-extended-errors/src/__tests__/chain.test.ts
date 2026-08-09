import { describe, expect, it } from 'vitest'
import { causeChain, findCause, findCauseOf, hasCauseOf, rootCause } from '../chain'
import { defineError } from '../defineError'
import { ExtendedError } from '../ExtendedError'

const TimeoutError = defineError('TimeoutError', { code: 'TIMEOUT' })

const nested = (): Error => {
  const timeout = new TimeoutError('read timed out')
  const query = new ExtendedError('query failed', { cause: timeout })
  return new ExtendedError('request failed', { cause: query })
}

describe('causeChain', () => {
  it('walks outermost first and includes the error itself', () => {
    const error = nested()
    const chain = causeChain(error)

    expect(chain).toHaveLength(3)
    expect(chain[0]).toBe(error)
    expect(chain[2]).toBeInstanceOf(TimeoutError)
  })

  it('returns a single element for an error with no cause', () => {
    const error = new ExtendedError('alone')

    expect(causeChain(error)).toEqual([error])
  })

  it('stops at a non-error cause instead of throwing', () => {
    const error = new ExtendedError('wrapper', { cause: 'a string' })

    expect(causeChain(error)).toEqual([error, 'a string'])
  })

  it('terminates on a cycle', () => {
    const a = new ExtendedError('a')
    const b = new ExtendedError('b', { cause: a })
    Object.defineProperty(a, 'cause', { value: b, configurable: true })

    expect(causeChain(b)).toEqual([b, a])
  })

  it('terminates on a self-referencing cause', () => {
    const a = new ExtendedError('a')
    Object.defineProperty(a, 'cause', { value: a, configurable: true })

    expect(causeChain(a)).toEqual([a])
  })

  it('is empty for nothing at all', () => {
    expect(causeChain(undefined)).toEqual([])
    expect(causeChain(null)).toEqual([])
  })
})

describe('rootCause', () => {
  it('returns the deepest cause', () => {
    expect(rootCause(nested())).toBeInstanceOf(TimeoutError)
  })

  it('returns the error itself when it has no cause', () => {
    const error = new ExtendedError('alone')

    expect(rootCause(error)).toBe(error)
  })

  it('passes through a value with no chain', () => {
    expect(rootCause(undefined)).toBeUndefined()
  })
})

describe('findCause', () => {
  it('returns the first match, outermost first', () => {
    const error = nested()

    expect(findCause(error, (candidate) => candidate instanceof ExtendedError)).toBe(error)
  })

  it('returns undefined when nothing matches', () => {
    expect(findCause(nested(), (candidate) => candidate === 'nope')).toBeUndefined()
  })

  it('narrows through a type guard', () => {
    const found = findCause(nested(), (candidate): candidate is Error => candidate instanceof Error)

    // The point of the overload: `found` is `Error | undefined` here, so
    // reading `.message` type-checks without a cast.
    expect(found?.message).toBe('request failed')
  })
})

describe('findCauseOf', () => {
  it('reaches a wrapped error the outer instanceof would miss', () => {
    const error = nested()

    expect(error).not.toBeInstanceOf(TimeoutError)
    expect(findCauseOf(error, TimeoutError)?.code).toBe('TIMEOUT')
  })

  it('returns undefined when the class is absent', () => {
    expect(findCauseOf(new ExtendedError('alone'), TimeoutError)).toBeUndefined()
  })
})

describe('hasCauseOf', () => {
  it('answers the same question as a boolean', () => {
    expect(hasCauseOf(nested(), TimeoutError)).toBe(true)
    expect(hasCauseOf(new ExtendedError('alone'), TimeoutError)).toBe(false)
  })
})

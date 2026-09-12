import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { toError } from '../toError'
import { ExtendedError } from '../ExtendedError'

describe('toError', () => {
  it('passes an Error through untouched', () => {
    const error = new Error('boom')

    expect(toError(error)).toBe(error)
  })

  it('passes an ExtendedError through untouched', () => {
    const error = new ExtendedError('boom')

    expect(toError(error)).toBe(error)
  })

  it('wraps a thrown string', () => {
    const error = toError('nope')

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('nope')
    expect(error.cause).toBe('nope')
  })

  it('wraps a thrown object', () => {
    const thrown = { status: 500 }
    const error = toError(thrown)

    expect(error.message).toBe('{"status":500}')
    expect(error.cause).toBe(thrown)
  })

  it('wraps undefined', () => {
    expect(toError(undefined).message).toBe('undefined')
  })

  it('rebuilds an error-shaped value, keeping its name and stack', () => {
    const foreign = { name: 'ForeignError', message: 'from elsewhere', stack: 'ForeignError: …' }
    const error = toError(foreign)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ForeignError')
    expect(error.message).toBe('from elsewhere')
    expect(error.stack).toBe('ForeignError: …')
    // The original is kept, because it may carry fields this package knows
    // nothing about.
    expect(error.cause).toBe(foreign)
  })

  it('rebuilds an error-shaped value that has neither name nor stack', () => {
    const error = toError({ message: 'bare' })

    expect(error.name).toBe('ExtendedError')
    expect(error.message).toBe('bare')
    expect(error.stack).toBeTypeOf('string')
  })

  it('rebuilds a real error from another realm, which fails instanceof', () => {
    const foreign: unknown = runInNewContext('new RangeError("from a vm")')

    const error = toError(foreign)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('RangeError')
    expect(error.message).toBe('from a vm')
    expect(error.stack).toContain('RangeError: from a vm')
    expect(error.cause).toBe(foreign)
  })

  it('keeps the default name when the error-shaped value has a non-string one', () => {
    expect(toError({ message: 'boom', name: 42 }).name).toBe('ExtendedError')
  })

  it('wraps null', () => {
    const error = toError(null)

    expect(error.message).toBe('null')
    expect(error.cause).toBeNull()
  })
})

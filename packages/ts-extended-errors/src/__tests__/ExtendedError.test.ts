import { describe, expect, it } from 'vitest'
import { ExtendedError, isExtendedError } from '../ExtendedError'

class ConfigError extends ExtendedError<{ file: string }> {
  static override readonly code = 'CONFIG'
}

describe('ExtendedError', () => {
  it('is a real Error', () => {
    const error = new ExtendedError('boom')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ExtendedError)
    expect(error.message).toBe('boom')
  })

  it('takes its name from the constructed class, not the base', () => {
    expect(new ExtendedError('boom').name).toBe('ExtendedError')
    expect(new ConfigError('boom').name).toBe('ConfigError')
  })

  it('survives subclassing', () => {
    const error = new ConfigError('missing "port"', { context: { file: 'app.json' } })

    expect(error).toBeInstanceOf(ConfigError)
    expect(error).toBeInstanceOf(ExtendedError)
    expect(error).toBeInstanceOf(Error)
    expect(error.context).toEqual({ file: 'app.json' })
  })

  it('copies the static code onto the instance', () => {
    expect(new ConfigError('boom').code).toBe('CONFIG')
    expect(new ExtendedError('boom').code).toBeUndefined()
  })

  it('forwards cause to the native property', () => {
    const cause = new Error('underlying')
    const error = new ExtendedError('wrapper', { cause })

    expect(error.cause).toBe(cause)
  })

  it('does not define cause when none was passed', () => {
    // The distinction matters: `'cause' in error` is how a walker decides
    // whether there is anything below, and `{ cause: undefined }` would lie.
    expect('cause' in new ExtendedError('boom')).toBe(false)
    expect('cause' in new ExtendedError('boom', { cause: undefined })).toBe(true)
  })

  it('accepts a non-error cause', () => {
    const error = new ExtendedError('wrapper', { cause: 'a string' })

    expect(error.cause).toBe('a string')
  })

  it('starts the stack at the throw site, not inside the constructor', () => {
    const error = new ConfigError('boom')

    expect(error.stack).toBeTypeOf('string')
    expect(error.stack).toContain('ConfigError: boom')
    // The frames for ExtendedError's own constructor are what
    // captureStackTrace drops.
    expect(error.stack).not.toContain('at new ExtendedError')
  })

  it('constructs on an engine without captureStackTrace', () => {
    // JavaScriptCore and SpiderMonkey have no such method, and this class must
    // not become V8-only by accident.
    // The descriptor rather than the function, so the restore puts back the
    // exact property — and so this never reads as an unbound method.
    const descriptor = Object.getOwnPropertyDescriptor(Error, 'captureStackTrace')
    Reflect.deleteProperty(Error, 'captureStackTrace')

    try {
      const error = new ConfigError('boom')

      expect(error.name).toBe('ConfigError')
      expect(error.stack).toBeTypeOf('string')
    } finally {
      if (descriptor) Object.defineProperty(Error, 'captureStackTrace', descriptor)
    }
  })

  it('serializes through JSON.stringify', () => {
    const error = new ConfigError('missing "port"', {
      context: { file: 'app.json' },
      cause: new Error('ENOENT'),
    })

    const parsed = JSON.parse(JSON.stringify(error)) as Record<string, unknown>

    expect(parsed).toMatchObject({
      name: 'ConfigError',
      message: 'missing "port"',
      code: 'CONFIG',
      context: { file: 'app.json' },
      cause: { name: 'Error', message: 'ENOENT' },
    })
  })

  it('has an empty context when none was given', () => {
    expect(new ExtendedError('boom').context).toBeUndefined()
  })
})

describe('isExtendedError', () => {
  it('accepts instances and rejects everything else', () => {
    expect(isExtendedError(new ExtendedError('boom'))).toBe(true)
    expect(isExtendedError(new ConfigError('boom'))).toBe(true)
    expect(isExtendedError(new Error('boom'))).toBe(false)
    expect(isExtendedError('boom')).toBe(false)
    expect(isExtendedError(null)).toBe(false)
  })
})

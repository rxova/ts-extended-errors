import { describe, expect, it } from 'vitest'
import { describeValue, isErrorLike, serializeError } from '../serialize'
import { ExtendedError } from '../ExtendedError'

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

import { describe, expect, it } from 'vitest'
import { defineError } from '../defineError'
import { ExtendedError } from '../ExtendedError'

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
})

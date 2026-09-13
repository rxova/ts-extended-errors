import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ExtendedError, defineError, deserializeError, serializeError } from '../index'
import type { SerializeErrorOptions, SerializedErrorWithProperties } from '../index'

const HttpError = defineError('HttpError', { code: 'HTTP' })
const NotFoundError = defineError('NotFoundError', { base: HttpError, code: 'HTTP_NOT_FOUND' })
const OutOfRangeError = defineError('OutOfRangeError', { base: RangeError, code: 'OUT_OF_RANGE' })

/** A structured logger's output: one JSON line per record, the way pino or a log shipper writes it. */
const logLine = (error: unknown, options?: SerializeErrorOptions): string =>
  JSON.stringify({ level: 'error', err: serializeError(error, options) })

/** The `err` field of a line, as a log reader sees it. */
const readErr = (line: string): SerializedErrorWithProperties =>
  (JSON.parse(line) as { err: SerializedErrorWithProperties }).err

/** A V8 stack frame line as it appears in JSON text, where the newline is escaped. */
const FRAME = /\\n\s+at /

/** A request error carrying the kind of field a real one does. */
class RequestError extends ExtendedError {
  readonly authorization = 'Bearer SECRET-TOKEN'
}

const REDACTED_KEYS: ReadonlySet<string> = new Set(['password', 'apiKey', 'authorization'])

/** A key-based redactor, as a `JSON.stringify` replacer. */
const redact = (key: string, value: unknown): unknown =>
  REDACTED_KEYS.has(key) ? '[REDACTED]' : value

describe('logging an error', () => {
  it('writes the whole chain, each level with its own stack from its own throw site', () => {
    const error = new HttpError('loading the profile failed', {
      cause: new NotFoundError('no such user', { cause: new OutOfRangeError('page 0') }),
    })

    const err = readErr(logLine(error))

    const stacks = [err.stack, err.cause?.stack, err.cause?.cause?.stack]
    expect(stacks.map((stack) => stack?.split('\n')[0])).toEqual([
      'HttpError: loading the profile failed',
      'NotFoundError: no such user',
      'OutOfRangeError: page 0',
    ])
    for (const stack of stacks) {
      expect(stack?.split('\n')[1]).toContain('logging.test.ts')
    }
  })

  it('keeps the line bounded however deep the chain', () => {
    let error: Error = new Error('root')
    for (let level = 0; level < 10_000; level += 1) {
      error = new ExtendedError(`level ${String(level)}`, { cause: error })
    }

    const depth = (serialized: SerializedErrorWithProperties | undefined): number =>
      serialized === undefined ? 0 : 1 + depth(serialized.cause)

    expect(depth(readErr(logLine(error)))).toBe(9)
    expect(depth(readErr(logLine(error, { maxDepth: 2 })))).toBe(3)
  })

  it('logs a Node system error with its code, and its other fields only on request', () => {
    const path = '/no/such/dir/customer-export.csv'
    let thrown: unknown
    try {
      readFileSync(path)
    } catch (error) {
      thrown = error
    }

    const plain = readErr(logLine(thrown, { includeStack: false }))
    const full = readErr(logLine(thrown, { includeStack: false, includeOwnProperties: true }))

    expect(plain.code).toBe('ENOENT')
    expect(Object.keys(plain).sort()).toEqual(['code', 'message', 'name'])
    expect(full).toMatchObject({ code: 'ENOENT', syscall: 'open', path })
    // Node names the path in the message too, so leaving own fields out is not
    // a way to keep it out of the log.
    expect(plain.message).toContain(path)
  })
})

describe('redacting what reaches a log or a response', () => {
  it('leaves own fields out by default, at every level of the chain', () => {
    const error = new RequestError('upstream call failed', {
      cause: new RequestError('token refresh failed'),
    })

    expect(logLine(error)).not.toContain('SECRET-TOKEN')
    expect(JSON.stringify(error)).not.toContain('SECRET-TOKEN')

    const err = readErr(logLine(error, { includeOwnProperties: true }))
    expect(err.authorization).toBe('Bearer SECRET-TOKEN')
    expect(err.cause?.authorization).toBe('Bearer SECRET-TOKEN')
  })

  it('drops every stack when told to, including those of errors held in own fields', () => {
    const error = Object.assign(new HttpError('outer', { cause: new Error('inner') }), {
      original: new TypeError('held in a field'),
    })

    const line = logLine(error, { includeStack: false, includeOwnProperties: true })

    expect(readErr(line).original).toEqual({ name: 'TypeError', message: 'held in a field' })
    expect(line).not.toContain('"stack"')
    expect(line).not.toMatch(FRAME)
    expect(line).not.toContain('logging.test.ts')
  })

  it('puts the stack in JSON.stringify(error), so a response body goes through serializeError', () => {
    const error = new NotFoundError('no such user', { cause: new Error('row missing') })

    expect(JSON.stringify({ error })).toMatch(FRAME)
    expect(JSON.stringify({ error: serializeError(error, { includeStack: false }) })).not.toMatch(
      FRAME,
    )
  })

  it('writes context as given at every level, leaving redaction to the caller', () => {
    const error = new HttpError('login failed', {
      context: { userId: 42, password: 'hunter2' },
      cause: new ExtendedError('key rejected', { context: { apiKey: 'k-123' } }),
    })

    expect(logLine(error)).toContain('hunter2')
    expect(logLine(error)).toContain('k-123')
  })

  it('shapes its output so a key-based redactor reaches context and own fields at any depth', () => {
    const error = new RequestError('login failed', {
      context: { userId: 42, password: 'hunter2' },
      cause: new RequestError('key rejected', { context: { apiKey: 'k-123' } }),
    })

    const line = JSON.stringify(serializeError(error, { includeOwnProperties: true }), redact)

    for (const secret of ['hunter2', 'k-123', 'SECRET-TOKEN']) {
      expect(line).not.toContain(secret)
    }
    const err = JSON.parse(line) as SerializedErrorWithProperties
    expect(err.context).toEqual({ userId: 42, password: '[REDACTED]' })
    expect(err.cause?.context).toEqual({ apiKey: '[REDACTED]' })
    expect(err.cause?.authorization).toBe('[REDACTED]')
    // A replacer copies as it goes; the error itself keeps what it held.
    expect(error.context).toEqual({ userId: 42, password: 'hunter2' })
  })

  it('repeats the message in the stack header, so redacting one leaves it in the other', () => {
    const error = new Error('login failed for alice@example.com')
    const hideMessage = (key: string, value: unknown): unknown =>
      key === 'message' ? '[REDACTED]' : value

    expect(JSON.stringify(serializeError(error), hideMessage)).toContain('alice@example.com')
    expect(
      JSON.stringify(serializeError(error, { includeStack: false }), hideMessage),
    ).not.toContain('alice@example.com')
  })

  it('describes a non-error cause into a message string, out of reach of a key-based redactor', () => {
    const error = new ExtendedError('upstream rejected', {
      cause: { status: 401, password: 'hunter2' },
    })

    const line = JSON.stringify(serializeError(error, { includeStack: false }), redact)

    expect((JSON.parse(line) as SerializedErrorWithProperties).cause).toEqual({
      name: 'object',
      message: '{"status":401,"password":"hunter2"}',
    })
  })

  it('rebuilds a redacted line as the original classes, with the redaction intact', () => {
    const error = new NotFoundError('no such user', {
      context: { userId: 42, password: 'hunter2' },
    })

    const back = deserializeError(JSON.parse(JSON.stringify(serializeError(error), redact)), {
      classes: [HttpError, NotFoundError],
    })

    const notFound = back as InstanceType<typeof NotFoundError>
    expect(back).toBeInstanceOf(NotFoundError)
    expect(notFound.context).toEqual({ userId: 42, password: '[REDACTED]' })
    expect(notFound.stack).toBe(error.stack)
  })
})

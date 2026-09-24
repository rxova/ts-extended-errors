import { describe, expect, it } from 'vitest'

import { after, before, lineMarkers, notes } from './snippets.ts'
import {
  CardDeclinedError,
  CheckoutError,
  RateLimitError,
  respond,
  runCheckout,
} from './snippets/after.ts'

/** What the API receives when the charge throws `cause`: the worker's result, through JSON. */
async function overTheWire(cause) {
  const result = await runCheckout('order-7', () => Promise.reject(cause))
  expect(result.ok).toBe(false)
  return JSON.parse(JSON.stringify(result.error))
}

describe('the home page snippet', () => {
  it('reports success without an error', async () => {
    expect(await runCheckout('order-7', () => Promise.resolve())).toEqual({ ok: true })
  })

  it('sends the wrapper, its context and the cause as JSON, with no stack', async () => {
    const payload = await overTheWire(
      new CardDeclinedError({ context: { reason: 'expired', last4: '4242' } }),
    )

    expect(payload).toEqual({
      name: 'CheckoutError',
      message: 'checkout failed',
      code: 'CHECKOUT',
      context: { orderId: 'order-7' },
      cause: {
        name: 'CardDeclinedError',
        message: 'card ending 4242 declined: expired',
        code: 'CARD_DECLINED',
        context: { reason: 'expired', last4: '4242' },
      },
    })
  })

  it('sends exactly the object the comment in the worker shows', async () => {
    // That comment is what a reader takes away about the wire format, so it is
    // held to the real output rather than left to drift.
    const payload = await overTheWire(
      new RateLimitError({ context: { limit: 100, retryAfterMs: 1200 } }),
    )

    expect(payload).toEqual({
      name: 'CheckoutError',
      message: 'checkout failed',
      code: 'CHECKOUT',
      context: { orderId: 'order-7' },
      cause: {
        name: 'RateLimitError',
        message: 'rate limit of 100 hit, retry in 1200 ms',
        code: 'RATE_LIMITED',
        context: { limit: 100, retryAfterMs: 1200 },
      },
    })
    expect(after).toContain("context: { orderId: 'order-7' },")
    expect(after).toContain("code: 'RATE_LIMITED', context: { limit: 100, retryAfterMs: 1200 },")
  })

  it('answers 402 with the typed reason for a declined card', async () => {
    const payload = await overTheWire(
      new CardDeclinedError({ context: { reason: 'insufficient_funds', last4: '0005' } }),
    )

    expect(respond(payload)).toEqual({ status: 402, reason: 'insufficient_funds' })
  })

  it('answers 429 with the limit and the delay, however deep it is wrapped', async () => {
    const limited = new RateLimitError({ context: { limit: 100, retryAfterMs: 1200 } })
    expect(limited.message).toBe('rate limit of 100 hit, retry in 1200 ms')
    const payload = await overTheWire(
      new CheckoutError('retrying failed', { cause: limited, context: { orderId: 'order-6' } }),
    )

    expect(respond(payload)).toEqual({ status: 429, limit: 100, retryAfterMs: 1200 })
  })

  it.each([['boom'], [null], [new Error('disk full')]])('answers 500 for %s', async (cause) => {
    expect(respond(await overTheWire(cause))).toEqual({ status: 500 })
  })

  it('answers 500 for a payload that is not an error at all', () => {
    expect(respond({ unexpected: true })).toEqual({ status: 500 })
    expect(respond(undefined)).toEqual({ status: 500 })
  })

  it('displays the module it tests', () => {
    // `after` is read with `?raw`; this pins that it is this module's text and
    // not a stale copy, by the names the tests above rely on.
    for (const name of [
      'defineError',
      'serializeError',
      'deserializeError',
      'findCauseOf',
      'CardDeclinedError',
      'RateLimitError',
      'CheckoutError',
      'function runCheckout',
      'function respond',
    ]) {
      expect(after).toContain(name)
    }
  })
})

describe('the notes', () => {
  it('each point at a line on both sides, numbered in order', () => {
    for (const [side, code] of [
      ['before', before],
      ['after', after],
    ]) {
      const markers = lineMarkers(code, side)
      const labels = [...new Set(markers.map((marker) => marker.label))]

      expect(labels, side).toEqual(notes.map((_, index) => String(index + 1)))
      for (const { range } of markers) {
        expect(Number(range), side).toBeGreaterThanOrEqual(1)
        expect(Number(range), side).toBeLessThanOrEqual(code.split('\n').length)
      }
    }
  })

  it('numbers every line a note points at, not just the first of a block', () => {
    // Each class's name, fields and prototype fix-up sit together.
    const first = lineMarkers(before, 'before').filter((marker) => marker.label === '1')
    expect(first.map(({ range }) => before.split('\n')[Number(range) - 1].trim())).toEqual([
      "this.name = 'CardDeclinedError'",
      'this.reason = reason',
      'this.last4 = last4',
      'Object.setPrototypeOf(this, CardDeclinedError.prototype)',
      "this.name = 'RateLimitError'",
      'this.limit = limit',
      'this.retryAfterMs = retryAfterMs',
      'Object.setPrototypeOf(this, RateLimitError.prototype)',
    ])
  })

  it('fails loudly for a note that points at nothing', () => {
    expect(() => lineMarkers('const x = 1', 'after')).toThrow(/note 1: no after line has/)
  })
})

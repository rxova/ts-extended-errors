import { defineError, deserializeError, findCauseOf, serializeError } from 'ts-extended-errors'

// errors.ts: shared by the worker and the API
type CardDeclined = { reason: 'expired' | 'insufficient_funds'; last4: string }
type RateLimited = { limit: number; retryAfterMs: number }

export const CardDeclinedError = defineError<CardDeclined>('CardDeclinedError', {
  code: 'CARD_DECLINED',
  message: ({ reason, last4 }) => `card ending ${last4} declined: ${reason}`,
})
export const RateLimitError = defineError<RateLimited>('RateLimitError', {
  code: 'RATE_LIMITED',
  message: ({ limit, retryAfterMs }) =>
    `rate limit of ${String(limit)} hit, retry in ${String(retryAfterMs)} ms`,
})
export const CheckoutError = defineError<{ orderId: string }>('CheckoutError', { code: 'CHECKOUT' })

// worker.ts: charges the card, and reports a failure as JSON
export async function runCheckout(orderId: string, charge: () => Promise<void>) {
  try {
    await charge()
    return { ok: true }
  } catch (cause) {
    const error = new CheckoutError('checkout failed', { cause, context: { orderId } })
    // error: {
    //   name: 'CheckoutError', message: 'checkout failed', code: 'CHECKOUT',
    //   context: { orderId: 'order-7' },
    //   cause: {
    //     name: 'RateLimitError', message: 'rate limit of 100 hit, retry in 1200 ms',
    //     code: 'RATE_LIMITED', context: { limit: 100, retryAfterMs: 1200 },
    //   },
    // }
    return { ok: false, error: serializeError(error, { includeStack: false }) }
  }
}

// api.ts: receives that JSON, and decides what the customer sees
export function respond(payload: unknown) {
  const error = deserializeError(payload, {
    classes: [CheckoutError, CardDeclinedError, RateLimitError],
  })

  // error is a chain:  CheckoutError { orderId }
  //                      └─ cause: RateLimitError { limit, retryAfterMs }
  // findCauseOf walks down it and returns the first RateLimitError, typed, or undefined.
  const limited = findCauseOf(error, RateLimitError)
  if (limited) return { status: 429, ...limited.context } // { limit: number; retryAfterMs: number }

  // The same search for a declined card, however many wrappers deep it is.
  const declined = findCauseOf(error, CardDeclinedError)
  if (declined) return { status: 402, reason: declined.context.reason } // 'expired' | 'insufficient_funds'

  return { status: 500 }
}

// The two sides of the home page's comparison, and the notes that pair them.
//
// `after` is the text of a real module, read through `?raw`, so what the page
// shows is exactly what snippets.test.mjs runs — there is no second copy to
// drift. `before` is only ever displayed. It is the same job done by hand, and
// it is wrong on purpose, so it is kept as a string: compiled, it would need
// its lint findings switched off, and those findings are the point.
//
// The story is a boundary, because that is where hand-written errors fail
// outright rather than merely read worse: a worker charges a card, the charge
// fails, and the API on the other side of a JSON hop has to decide whether to
// retry or to tell the customer why.

import after from './snippets/after.ts?raw'

export { after }

export const before = `// errors.ts: shared by the worker and the API
class CardDeclinedError extends Error {
  reason: 'expired' | 'insufficient_funds'
  last4: string
  constructor(reason: 'expired' | 'insufficient_funds', last4: string) {
    super(\`card ending \${last4} declined: \${reason}\`)
    this.name = 'CardDeclinedError'
    this.reason = reason
    this.last4 = last4
    Object.setPrototypeOf(this, CardDeclinedError.prototype)
  }
}
class RateLimitError extends Error {
  limit: number
  retryAfterMs: number
  constructor(limit: number, retryAfterMs: number) {
    super(\`rate limit of \${limit} hit, retry in \${retryAfterMs} ms\`)
    this.name = 'RateLimitError'
    this.limit = limit
    this.retryAfterMs = retryAfterMs
    Object.setPrototypeOf(this, RateLimitError.prototype)
  }
}

// wire.ts: a payload, a guard and a rebuild for every class, kept in step by hand
type CardDeclinedPayload = { name: 'CardDeclinedError'; reason: 'expired' | 'insufficient_funds'; last4: string }
type RateLimitPayload = { name: 'RateLimitError'; limit: number; retryAfterMs: number }

function toPayload(e: unknown): CardDeclinedPayload | RateLimitPayload | { name: 'Error' } {
  if (e instanceof CardDeclinedError) return { name: 'CardDeclinedError', reason: e.reason, last4: e.last4 }
  if (e instanceof RateLimitError) return { name: 'RateLimitError', limit: e.limit, retryAfterMs: e.retryAfterMs }
  return { name: 'Error' }
}

const isCardDeclined = (p: any): p is CardDeclinedPayload =>
  p?.name === 'CardDeclinedError' && typeof p.reason === 'string' && typeof p.last4 === 'string'
const isRateLimit = (p: any): p is RateLimitPayload =>
  p?.name === 'RateLimitError' && typeof p.limit === 'number' && typeof p.retryAfterMs === 'number'

function fromPayload(p: unknown): Error {
  if (isCardDeclined(p)) return new CardDeclinedError(p.reason, p.last4)
  if (isRateLimit(p)) return new RateLimitError(p.limit, p.retryAfterMs)
  return new Error('unknown failure')
}

// worker.ts: charges the card, and reports a failure as JSON
async function runCheckout(orderId: string, charge: () => Promise<void>) {
  try {
    await charge()
    return { ok: true }
  } catch (e) {
    // error: { name: 'RateLimitError', limit: 100, retryAfterMs: 1200 }
    // No orderId: wrapping e to carry it would hide e from toPayload's instanceof checks
    return { ok: false, error: toPayload(e) }
  }
}

// api.ts: receives that JSON, and decides what the customer sees
function respond(payload: unknown) {
  const error = fromPayload(payload)
  if (error instanceof RateLimitError) {
    return { status: 429, limit: error.limit, retryAfterMs: error.retryAfterMs }
  }
  if (error instanceof CardDeclinedError) return { status: 402, reason: error.reason }
  return { status: 500 }
}
`

/**
 * One problem on the `before` side and the fix for it on the `after` side.
 * `lines` are fragments of the code each note points at; the lines holding
 * them get the note's number in the code's gutter.
 */
interface Note {
  problem: string
  fix: string
  lines: { before: string[]; after: string[] }
}

export const notes: Note[] = [
  {
    problem:
      'Every class declares and assigns each field, sets its `name` and fixes its prototype.',
    fix: '`defineError` writes the class, its code and its message, all from one context type.',
    lines: {
      before: [
        "this.name = 'CardDeclinedError'",
        'this.reason = reason',
        'this.last4 = last4',
        "this.name = 'RateLimitError'",
        'this.limit = limit',
        'this.retryAfterMs = retryAfterMs',
        'Object.setPrototypeOf',
      ],
      after: [
        'type CardDeclined =',
        'type RateLimited =',
        "defineError<CardDeclined>('CardDeclinedError'",
        "code: 'CARD_DECLINED'",
        'message: ({ reason, last4 })',
        "defineError<RateLimited>('RateLimitError'",
        "code: 'RATE_LIMITED'",
        'message: ({ limit, retryAfterMs })',
        '`rate limit of',
        'defineError<{ orderId',
      ],
    },
  },
  {
    problem:
      'A payload type and a `toPayload` branch for every class. Add a field and forget one, and it stays behind.',
    fix: '`serializeError` handles every class the same way: name, code, context and the whole cause chain.',
    lines: {
      before: [
        'type CardDeclinedPayload',
        'type RateLimitPayload',
        'if (e instanceof CardDeclinedError) return',
        'if (e instanceof RateLimitError) return',
      ],
      after: ['serializeError(error'],
    },
  },
  {
    problem:
      'A type guard and a `fromPayload` branch for every class, to recognise the payload and rebuild it.',
    fix: '`deserializeError` rebuilds the real classes from the list it is given. There are no guards to write.',
    lines: {
      before: [
        'const isCardDeclined',
        "p?.name === 'CardDeclinedError'",
        'const isRateLimit',
        "p?.name === 'RateLimitError'",
        'if (isCardDeclined(p))',
        'if (isRateLimit(p))',
      ],
      after: ['deserializeError(payload', 'classes: [CheckoutError'],
    },
  },
  {
    problem:
      'Only the outer error travels. Wrap it to add the order id, and `toPayload` no longer knows it: a 500.',
    fix: 'The wrapper carries the order id, its `cause` travels with it, and `findCauseOf` finds it at any depth.',
    lines: {
      before: ['No orderId: wrapping e', 'error: toPayload(e)'],
      after: [
        "new CheckoutError('checkout failed'",
        'findCauseOf(error, RateLimitError)',
        'findCauseOf(error, CardDeclinedError)',
      ],
    },
  },
]

/**
 * The gutter markers for one side: every line a note points at, labelled with
 * the note's number. One marker per line rather than one per block, so every
 * highlighted line carries its number — a block shows its label on its first
 * line only, and the rest read as unnumbered.
 *
 * A fragment that matches no line throws, which fails the build — a note that
 * points at nothing is how a label ends up on the wrong line after an edit.
 */
export function lineMarkers(code: string, side: 'before' | 'after') {
  const lines = code.split('\n')
  return notes.flatMap((note, index) => {
    const numbers = note.lines[side].flatMap((fragment) => {
      const found = lines.flatMap((line, at) => (line.includes(fragment) ? [at + 1] : []))
      if (found.length === 0) {
        throw new Error(`note ${String(index + 1)}: no ${side} line has ${fragment}`)
      }
      return found
    })
    return [...new Set(numbers)]
      .sort((a, b) => a - b)
      .map((line) => ({ range: String(line), label: String(index + 1) }))
  })
}

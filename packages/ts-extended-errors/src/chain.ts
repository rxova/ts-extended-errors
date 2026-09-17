import { isInstanceOf, read } from './safe'

/**
 * Walks `error` and everything under its `cause`, outermost first.
 *
 * The first element is `error` itself, so an error with no cause yields a
 * one-element chain. Values are `unknown` because `cause` is `unknown`: nothing
 * stops someone from throwing `{ cause: 'timeout' }`, and a walker that assumed
 * otherwise would throw while you were trying to report a failure.
 *
 * Cycles terminate: `a.cause = b; b.cause = a` yields `[a, b]`. A `cause`
 * getter or proxy trap that throws ends the chain at that value; inspecting an
 * error must not replace it with an inspection failure.
 */
export function causeChain(error: unknown): unknown[] {
  const chain: unknown[] = []
  const seen = new Set<unknown>()
  let current: unknown = error

  while (current !== undefined && current !== null) {
    chain.push(current)

    // A primitive cannot carry a cause, so the chain ends here.
    if (typeof current !== 'object') break
    seen.add(current)

    const next = read(current, 'cause')
    // Stopping on a value already on the chain is what makes a cycle terminate.
    if (seen.has(next)) break
    current = next
  }

  return chain
}

/**
 * The deepest value in the chain — the original failure.
 *
 * Returns `error` itself when there is no cause, which makes it safe to log
 * unconditionally.
 */
export function rootCause(error: unknown): unknown {
  const chain = causeChain(error)
  return chain.length > 0 ? chain[chain.length - 1] : error
}

/** Finds the first value in the chain matching `predicate`, narrowing it. */
export function findCause<T>(
  error: unknown,
  predicate: (candidate: unknown) => candidate is T,
): T | undefined
/** Finds the first value in the chain matching `predicate`. */
export function findCause(error: unknown, predicate: (candidate: unknown) => boolean): unknown
export function findCause(error: unknown, predicate: (candidate: unknown) => boolean): unknown {
  return causeChain(error).find((candidate) => predicate(candidate))
}

/**
 * Finds the first value in the chain that is an instance of `constructor`.
 *
 * This is the one you reach for in a `catch`: a low-level failure is usually
 * wrapped two or three times before it reaches the handler that knows what to
 * do about it, and a bare `error instanceof TimeoutError` only ever inspects
 * the outermost wrapper.
 *
 * @example
 * ```ts
 * const timeout = findCauseOf(error, TimeoutError)
 * if (timeout) return retryLater(timeout.context)
 * ```
 */
export function findCauseOf<T>(
  error: unknown,
  constructor: abstract new (...args: never[]) => T,
): T | undefined {
  return findCause(error, (candidate): candidate is T => isInstanceOf(candidate, constructor))
}

/** Whether anything in the chain is an instance of `constructor`. */
export function hasCauseOf(
  error: unknown,
  constructor: abstract new (...args: never[]) => unknown,
): boolean {
  return findCauseOf(error, constructor) !== undefined
}

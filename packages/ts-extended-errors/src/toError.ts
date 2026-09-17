import { ExtendedError } from './ExtendedError'
import { isInstanceOf, readString } from './safe'
import { describeValue } from './serialize'

const defineOwn = (target: object, key: string, value: unknown): void => {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: false,
    configurable: true,
  })
}

/**
 * Turns any thrown value into a real `Error`.
 *
 * A `catch` binding is `unknown` and JavaScript permits throwing anything, so
 * every honest error path starts with this narrowing. Errors pass through
 * untouched — wrapping one would bury the stack that says where it came from.
 * Throwing getters and proxy traps are treated as unavailable metadata; even a
 * value that refuses all inspection still becomes an `Error`.
 *
 * @example
 * ```ts
 * try {
 *   await run()
 * } catch (thrown) {
 *   logger.error(toError(thrown))
 * }
 * ```
 */
export function toError(value: unknown): Error {
  if (isInstanceOf(value, Error)) return value

  if (typeof value === 'object' && value !== null) {
    // Read once: a getter may be stateful as well as capable of throwing.
    const message = readString(value, 'message')
    if (message === undefined) return new ExtendedError(describeValue(value), { cause: value })

    // Error-shaped but not an Error: a cross-realm throw, or one that has been
    // through `structuredClone` or a JSON round trip. Rebuild a real Error and
    // keep the original as the cause, since it may carry fields this class
    // knows nothing about.
    const rebuilt = new ExtendedError(message, { cause: value })
    const name = readString(value, 'name')
    if (typeof name === 'string') defineOwn(rebuilt, 'name', name)
    const stack = readString(value, 'stack')
    if (typeof stack === 'string') defineOwn(rebuilt, 'stack', stack)
    return rebuilt
  }

  return new ExtendedError(describeValue(value), { cause: value })
}

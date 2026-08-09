import { ExtendedError } from './ExtendedError'
import { describeValue, isErrorLike } from './serialize'

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
  if (value instanceof Error) return value

  if (isErrorLike(value)) {
    // Error-shaped but not an Error: a cross-realm throw, or one that has been
    // through `structuredClone` or a JSON round trip. Rebuild a real Error and
    // keep the original as the cause, since it may carry fields this class
    // knows nothing about.
    const rebuilt = new ExtendedError(value.message, { cause: value })
    const name: unknown = (value as { name?: unknown }).name
    if (typeof name === 'string') defineOwn(rebuilt, 'name', name)
    const stack: unknown = (value as { stack?: unknown }).stack
    if (typeof stack === 'string') defineOwn(rebuilt, 'stack', stack)
    return rebuilt
  }

  return new ExtendedError(describeValue(value), { cause: value })
}

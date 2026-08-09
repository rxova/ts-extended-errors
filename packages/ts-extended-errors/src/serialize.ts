import type { ErrorContext, SerializedError } from './types'

/** Options for {@link serializeError}. */
export interface SerializeErrorOptions {
  /**
   * How far down the `cause` chain to walk. The chain is influenced by input
   * often enough (a parse error wrapping a network error wrapping…) that an
   * unbounded walk is a liability in a log path.
   *
   * @defaultValue 8
   */
  readonly maxDepth?: number
  /**
   * Whether to include `stack`. Off is the right choice for a response body and
   * the wrong one for a log line, so this defaults to `true` and expects the
   * response path to say otherwise.
   *
   * @defaultValue true
   */
  readonly includeStack?: boolean
}

const DEFAULT_MAX_DEPTH = 8

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null

/**
 * Reads a property off a value without asserting anything about its shape.
 *
 * Everything here works through `unknown` on purpose: a `catch` binding is
 * `unknown`, and by the time you are serializing you may well be holding an
 * error from another realm (a worker, a vm context, a second bundled copy of a
 * library) where `instanceof Error` is false but every field you care about is
 * present.
 */
const read = (value: object, key: string): unknown => (value as Record<string, unknown>)[key]

const readString = (value: object, key: string): string | undefined => {
  const property = read(value, key)
  return typeof property === 'string' ? property : undefined
}

/**
 * True for anything Error-shaped, including the cross-realm errors that fail
 * `instanceof Error`.
 */
export const isErrorLike = (value: unknown): value is Error =>
  isObject(value) && typeof read(value, 'message') === 'string'

/** Best-effort one-line description of a thrown value that is not an error. */
export const describeValue = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'symbol') return value.toString()
  if (typeof value === 'bigint') return `${value.toString()}n`
  if (!isObject(value)) return String(value)

  try {
    // Deliberately `unknown`: the lib types stringify as returning `string`,
    // but it genuinely returns undefined for a value whose `toJSON` does.
    const json: unknown = JSON.stringify(value)
    return typeof json === 'string' ? json : Object.prototype.toString.call(value)
  } catch {
    // Cyclic, or a `toJSON` that throws. Neither is a reason to lose the throw.
    return Object.prototype.toString.call(value)
  }
}

/**
 * Converts any thrown value into a plain, JSON-safe object.
 *
 * Non-errors are described rather than dropped: `throw 'nope'` is rare but real,
 * and a serializer that returns `{}` for it is how an incident becomes
 * unreadable.
 */
export function serializeError(
  value: unknown,
  options: SerializeErrorOptions = {},
): SerializedError {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  const includeStack = options.includeStack ?? true

  // Tracks the errors on the *current path* so a cause cycle terminates. A set
  // of the whole traversal would be wrong: the same error appearing under two
  // different branches is legitimate, not a cycle.
  const path = new Set<unknown>()

  const walk = (current: unknown, depth: number): SerializedError => {
    if (!isErrorLike(current)) {
      return { name: typeof current, message: describeValue(current) }
    }

    const serialized: {
      name: string
      message: string
      code?: string
      stack?: string
      context?: ErrorContext
      cause?: SerializedError
    } = {
      name: readString(current, 'name') ?? 'Error',
      // Not read through `readString`: isErrorLike has already established that
      // this one is a string.
      message: current.message,
    }

    const code = readString(current, 'code')
    if (code !== undefined) serialized.code = code

    if (includeStack) {
      const stack = readString(current, 'stack')
      if (stack !== undefined) serialized.stack = stack
    }

    const context = read(current, 'context')
    if (isObject(context)) serialized.context = context as ErrorContext

    const cause = read(current, 'cause')
    if (cause !== undefined && depth < maxDepth && !path.has(cause)) {
      path.add(current)
      serialized.cause = walk(cause, depth + 1)
      path.delete(current)
    }

    return serialized
  }

  return walk(value, 0)
}

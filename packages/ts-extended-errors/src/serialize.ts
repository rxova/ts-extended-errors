import type { ErrorContext, SerializedError, SerializedErrorWithProperties } from './types'

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
  /**
   * Whether to copy the error's own enumerable fields as well — the `sortKey`
   * or `statusCode` an error class assigns in its constructor, which the fixed
   * fields know nothing about.
   *
   * Off by default, because what those fields hold is up to whoever threw: a
   * request, a token, a user record. Turn it on for a log you control, not for
   * a response body.
   *
   * An error held in such a field is serialized the way a `cause` is, under the
   * same depth limit and cycle guard. Anything else is copied the way `context`
   * is, through a JSON round trip, so the result stays JSON-safe and detached
   * from the error, and a value that cannot survive one is described instead.
   * Functions, `undefined` and fields whose getter throws are skipped. The
   * fixed fields keep their meaning and are never overwritten.
   *
   * @defaultValue false
   */
  readonly includeOwnProperties?: boolean
}

// The internals below are exported for deserializeError, which reads the same
// shapes back; the package entry point does not re-export them.

export const DEFAULT_MAX_DEPTH = 8

/** The fields serializeError reads by name, which an own field must not overwrite. */
export const FIXED_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'message',
  'code',
  'stack',
  'context',
  'cause',
])

const NO_FIELDS: ReadonlySet<string> = new Set()

export const isObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null

/**
 * Reads a property off a value without asserting anything about its shape.
 *
 * Everything here works through `unknown` on purpose: a `catch` binding is
 * `unknown`, and by the time you are serializing you may well be holding an
 * error from another realm (a worker, a vm context, a second bundled copy of a
 * library) where `instanceof Error` is false but every field you care about is
 * present.
 */
export const read = (value: object, key: string): unknown => (value as Record<string, unknown>)[key]

export const readString = (value: object, key: string): string | undefined => {
  const property = read(value, key)
  return typeof property === 'string' ? property : undefined
}

/**
 * True for anything Error-shaped, including the cross-realm errors that fail
 * `instanceof Error`.
 */
export const isErrorLike = (value: unknown): value is Error =>
  isObject(value) && typeof read(value, 'message') === 'string'

/**
 * True for a real error, from this realm or another.
 *
 * Stricter than {@link isErrorLike} on purpose, for the values held in an
 * error's own fields: `{ message: 'Not found', status: 404 }` there is data,
 * and walking it as an error would relabel it `Error`. The tag check is what
 * recognises an error from a vm context, which fails `instanceof`.
 */
const isRealError = (value: unknown): boolean =>
  value instanceof Error || Object.prototype.toString.call(value) === '[object Error]'

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

/** A `JSON.stringify` replacer that writes a BigInt the way describeValue does, rather than throwing. */
const writeBigInt = (_key: string, value: unknown): unknown =>
  typeof value === 'bigint' ? `${value.toString()}n` : value

/**
 * A JSON round trip of `value`: what a log line would have carried anyway,
 * taken now, so a later mutation of the error cannot change it.
 */
const toJsonSafe = (value: unknown): unknown => {
  try {
    const json: unknown = JSON.stringify(value, writeBigInt)
    if (typeof json === 'string') return JSON.parse(json) as unknown
  } catch {
    // A cycle or a throwing `toJSON`: described below instead.
  }
  return describeValue(value)
}

/**
 * Copies `source`'s own enumerable fields, other than those in `skip`, onto
 * `target`, each through `copy`. Functions, `undefined`, fields whose getter
 * throws and fields `copy` returns `undefined` for are skipped.
 */
const copyFields = (
  source: object,
  target: object,
  skip: ReadonlySet<string>,
  copy: (value: unknown) => unknown,
): void => {
  for (const key of Object.keys(source)) {
    if (skip.has(key)) continue

    let value: unknown
    try {
      value = read(source, key)
    } catch {
      // A getter that throws. Losing one field beats losing the log line.
      continue
    }
    if (value === undefined || typeof value === 'function') continue

    const copied = copy(value)
    if (copied === undefined) continue

    // Defined rather than assigned: assigning to a key spelled `__proto__`
    // would replace the output's prototype instead of adding a field.
    Object.defineProperty(target, key, {
      value: copied,
      enumerable: true,
      writable: true,
      configurable: true,
    })
  }
}

/**
 * A detached, JSON-safe copy of `context`, taken field by field so that one
 * field JSON cannot write — a cycle, a `toJSON` that throws — is described on
 * its own instead of costing the rest.
 */
const copyContext = (context: object): ErrorContext => {
  const copy = {}
  copyFields(context, copy, NO_FIELDS, toJsonSafe)
  return copy
}

/**
 * Converts any thrown value into a plain, JSON-safe object.
 *
 * Non-errors are described rather than dropped: `throw 'nope'` is rare but real,
 * and a serializer that returns `{}` for it is how an incident becomes
 * unreadable.
 *
 * `context` is copied, not referenced: the result shares nothing with the error,
 * so a redactor can edit one without the other, and `JSON.stringify` cannot
 * throw on it.
 */
export function serializeError(
  value: unknown,
  options: SerializeErrorOptions & { readonly includeOwnProperties: true },
): SerializedErrorWithProperties
export function serializeError(value: unknown, options?: SerializeErrorOptions): SerializedError
export function serializeError(
  value: unknown,
  options: SerializeErrorOptions = {},
): SerializedErrorWithProperties {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  const includeStack = options.includeStack ?? true
  const includeOwnProperties = options.includeOwnProperties ?? false

  // Tracks the errors on the *current path* so a cycle terminates. A set of the
  // whole traversal would be wrong: the same error appearing under two
  // different branches is legitimate, not a cycle. The error being serialized
  // is on its own path, so one that is its own cause stops at once.
  const path = new Set<unknown>()

  const walk = (current: unknown, depth: number): SerializedErrorWithProperties => {
    if (!isErrorLike(current)) {
      return { name: typeof current, message: describeValue(current) }
    }

    // Recurses into something this error holds, unless that would pass the
    // depth limit or re-enter an error already being serialized above.
    const descend = (next: unknown): SerializedErrorWithProperties | undefined =>
      depth < maxDepth && !path.has(next) ? walk(next, depth + 1) : undefined

    path.add(current)

    const serialized: {
      name: string
      message: string
      code?: string
      stack?: string
      context?: ErrorContext
      cause?: SerializedErrorWithProperties
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
    if (isObject(context)) serialized.context = copyContext(context)

    const cause = read(current, 'cause')
    if (cause !== undefined) {
      const serializedCause = descend(cause)
      if (serializedCause !== undefined) serialized.cause = serializedCause
    }

    if (includeOwnProperties) {
      copyFields(current, serialized, FIXED_FIELDS, (field) =>
        isRealError(field) ? descend(field) : toJsonSafe(field),
      )
    }

    path.delete(current)
    return serialized
  }

  return walk(value, 0)
}

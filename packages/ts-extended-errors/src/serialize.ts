import { arrayItems, isInstanceOf, keys, objectTag, read, readString } from './safe'
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
  /**
   * How many errors to keep from the `errors` of AggregateErrors, counted
   * across the whole output. `Promise.any` over a thousand requests rejects
   * with a thousand errors, each of which may carry a chain of its own, so this
   * bounds the width of a log line the way `maxDepth` bounds its depth. A limit
   * per AggregateError would not: nested ones would multiply it.
   *
   * The errors it cuts are counted in `errorsOmitted`.
   *
   * @defaultValue 10
   */
  readonly maxAggregatedErrors?: number
}

// The internals below are exported for deserializeError, which reads the same
// shapes back; the package entry point does not re-export them.

export const DEFAULT_MAX_DEPTH = 8

const DEFAULT_MAX_AGGREGATED_ERRORS = 10

/** The fields serializeError reads by name, which an own field must not overwrite. */
export const FIXED_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'message',
  'code',
  'stack',
  'context',
  'cause',
])

/** The fixed fields of an AggregateError, which has its `errors` read by name as well. */
export const AGGREGATE_FIELDS: ReadonlySet<string> = new Set([
  ...FIXED_FIELDS,
  'errors',
  'errorsOmitted',
])

const NO_FIELDS: ReadonlySet<string> = new Set()

/**
 * Reads a `code` as errors carry them: a string, as Node's system errors and
 * this package's classes do, or a finite number, as a `DOMException` and many
 * driver errors do. Anything else is not a code, and is left to
 * `includeOwnProperties`.
 */
export const readCode = (value: object): string | number | undefined => {
  const code = read(value, 'code')
  if (typeof code === 'string') return code
  return typeof code === 'number' && Number.isFinite(code) ? code : undefined
}

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null

/**
 * True for anything Error-shaped, including the cross-realm errors that fail
 * `instanceof Error`. A throwing `message` getter or proxy trap returns false.
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
  isInstanceOf(value, Error) || (isObject(value) && objectTag(value) === '[object Error]')

/**
 * True for an AggregateError, from this realm or another.
 *
 * By name as well as by `instanceof`, since its string tag is `[object Error]`
 * like any other error's. Only an AggregateError's `errors` is read as a list
 * of errors: other classes keep other things under that name, such as the
 * messages of a validation error.
 */
const isAggregateError = (value: object): boolean =>
  isInstanceOf(value, AggregateError) || readString(value, 'name') === 'AggregateError'

/**
 * The errors an AggregateError lost before it reached this serializer: one on
 * an earlier hop wrote `errorsOmitted`, and deserializeError put it back.
 */
const omittedEarlier = (error: object): number => {
  const omitted = read(error, 'errorsOmitted')
  return typeof omitted === 'number' && Number.isSafeInteger(omitted) && omitted > 0 ? omitted : 0
}

/**
 * Best-effort one-line description of a thrown value that is not an error.
 *
 * A function is named rather than printed, since its source is not a
 * description and may be long. An object whose JSON is `{}` but whose string
 * tag says it is something else — a `Map`, a `Set`, a `WeakRef` — is described
 * by the tag, as JSON has nothing to say about it. An object that refuses both
 * JSON and string-tag inspection becomes `'<uninspectable object>'`.
 */
export const describeValue = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'symbol') return value.toString()
  if (typeof value === 'bigint') return `${value.toString()}n`
  if (typeof value === 'function') {
    const name = read(value, 'name')
    return typeof name === 'string' && name !== ''
      ? `[Function: ${name}]`
      : '[Function (anonymous)]'
  }
  if (!isObject(value)) return String(value)

  try {
    // Deliberately `unknown`: the lib types stringify as returning `string`,
    // but it genuinely returns undefined for a value whose `toJSON` does.
    const json: unknown = JSON.stringify(value)
    if (typeof json !== 'string') return objectTag(value) ?? '<uninspectable object>'
    if (json !== '{}') return json
    const tag = objectTag(value)
    return tag === undefined || tag === '[object Object]' ? json : tag
  } catch {
    // Cyclic, or a `toJSON` that throws. Neither is a reason to lose the throw.
    return objectTag(value) ?? '<uninspectable object>'
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
  for (const key of keys(source)) {
    if (skip.has(key)) continue

    const value = read(source, key)
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
 * throw on it. An AggregateError's `errors` are serialized the way a `cause` is,
 * within `maxAggregatedErrors`. Getters and proxy traps that throw are treated
 * as inaccessible fields rather than allowed to replace the failure being
 * serialized.
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

  // What is left of maxAggregatedErrors: one budget for the whole output.
  let aggregatedLeft = options.maxAggregatedErrors ?? DEFAULT_MAX_AGGREGATED_ERRORS

  // Tracks the errors on the *current path* so a cycle terminates. A set of the
  // whole traversal would be wrong: the same error appearing under two
  // different branches is legitimate, not a cycle. The error being serialized
  // is on its own path, so one that is its own cause stops at once.
  const path = new Set<unknown>()

  const walk = (current: unknown, depth: number): SerializedErrorWithProperties => {
    if (!isObject(current)) {
      return { name: typeof current, message: describeValue(current) }
    }

    // Read once: a getter may be stateful as well as capable of throwing.
    const message = readString(current, 'message')
    if (message === undefined) {
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
      code?: string | number
      stack?: string
      context?: ErrorContext
      cause?: SerializedErrorWithProperties
      errors?: SerializedErrorWithProperties[]
      errorsOmitted?: number
    } = {
      name: readString(current, 'name') ?? 'Error',
      message,
    }

    const code = readCode(current)
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

    const aggregate = isAggregateError(current)
    const errors = aggregate ? arrayItems(read(current, 'errors')) : undefined
    // At maxDepth the list goes the way a cause does, rather than coming out
    // empty and claiming there was nothing in it.
    if (errors !== undefined && depth < maxDepth) {
      const kept: SerializedErrorWithProperties[] = []
      let omitted = omittedEarlier(current)

      for (const item of errors as readonly unknown[]) {
        if (aggregatedLeft <= 0) {
          omitted += 1
          continue
        }
        // Spent before descending, so an AggregateError among them draws on
        // what is left after this one.
        aggregatedLeft -= 1
        const serializedItem = descend(item)
        // Below maxDepth only a cycle refuses, and a cycle is not a cut: the
        // item is dropped as a cyclic cause is, and its share comes back.
        if (serializedItem === undefined) aggregatedLeft += 1
        else kept.push(serializedItem)
      }

      serialized.errors = kept
      if (omitted > 0) serialized.errorsOmitted = omitted
    }

    if (includeOwnProperties) {
      copyFields(current, serialized, aggregate ? AGGREGATE_FIELDS : FIXED_FIELDS, (field) =>
        isRealError(field) ? descend(field) : toJsonSafe(field),
      )
    }

    path.delete(current)
    return serialized
  }

  return walk(value, 0)
}

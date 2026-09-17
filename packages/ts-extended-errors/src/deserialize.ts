import type { ErrorClass } from './defineError'
import { ExtendedError } from './ExtendedError'
import { AGGREGATE_FIELDS, DEFAULT_MAX_DEPTH, FIXED_FIELDS } from './serialize'
import { arrayItems, has, isInstanceOf, keys, read, readString, tryRead } from './safe'
import { toError } from './toError'
import type { ErrorContext } from './types'

/** Options for {@link deserializeError}. */
export interface DeserializeErrorOptions {
  /**
   * The classes to rebuild errors as, matched by name against the serialized
   * `name`. The built-in classes with a `(message, options)` constructor —
   * `Error`, `TypeError`, `RangeError` and the rest — are always known; a class
   * listed here wins over a built-in of the same name.
   *
   * An error whose name matches nothing comes back as an {@link ExtendedError}
   * that keeps the serialized name, so it still reads right in a log but is
   * not `instanceof` anything more specific.
   *
   * `AggregateError`, whose constructor takes the errors first, is rebuilt as
   * one when the payload lists its `errors`. A payload without that list —
   * from a sender that did not write it — falls back like an unknown name,
   * rather than becoming an AggregateError that claims there were none.
   */
  readonly classes?: readonly ErrorClass[]
  /**
   * How far down the `cause` chain to rebuild. Below it, causes are left as
   * they came.
   *
   * @defaultValue 8
   */
  readonly maxDepth?: number
}

const BUILT_IN_CLASSES: readonly ErrorClass[] = [
  Error,
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,
]

/** True for a value that {@link serializeError} could have produced from an error. */
const hasName = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && typeof read(value, 'name') === 'string'

/**
 * Puts a serialized field back on a rebuilt error.
 *
 * Keeps the enumerability the class already gave the field, so an
 * ExtendedError still lists `name` among its keys and a built-in error still
 * does not. A field the class never set takes `enumerable`.
 */
const restore = (error: Error, key: string, value: unknown, enumerable: boolean): void => {
  // Defined rather than assigned, for the same reason serializeError defines
  // them: a field spelled `__proto__` must stay a field.
  Object.defineProperty(error, key, {
    value,
    enumerable: Object.getOwnPropertyDescriptor(error, key)?.enumerable ?? enumerable,
    writable: true,
    configurable: true,
  })
}

/**
 * Turns the output of {@link serializeError} back into real errors — after a
 * JSON round trip, a `postMessage` or a queue.
 *
 * The class is looked up by name in `options.classes` and the built-ins, and
 * constructed, so `instanceof` and `findCauseOf` work on the result. Then the
 * serialized fields are put back as they were: `name`, `code`, `context`,
 * `stack` and any own fields `includeOwnProperties` carried. The cause chain is
 * rebuilt the same way, down to `maxDepth`, and so are an AggregateError's
 * `errors`, with the `errorsOmitted` count kept for the next serializer.
 *
 * With no serialized stack the result has none either, rather than one that
 * points at this function instead of the failure.
 *
 * A real error is returned untouched, and a value that is not error-shaped goes
 * through {@link toError}. Getters and proxy traps that throw are treated as
 * inaccessible fields. Exceptions from a class in `classes` are not swallowed:
 * those constructors are caller-provided behavior, not payload inspection.
 *
 * @example
 * ```ts
 * const error = deserializeError(JSON.parse(line), { classes: [NotFoundError] })
 * error instanceof NotFoundError // true
 * ```
 */
export function deserializeError(value: unknown, options: DeserializeErrorOptions = {}): Error {
  if (isInstanceOf(value, Error)) return value
  if (typeof value !== 'object' || value === null) return toError(value)

  // Read once: a getter may be stateful as well as capable of throwing.
  const message = readString(value, 'message')
  if (message === undefined) return toError(value)

  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH

  // Later entries win, so a class of your own replaces a built-in of its name.
  const classes = new Map<string, ErrorClass>()
  for (const Class of [...BUILT_IN_CLASSES, ...(options.classes ?? [])]) {
    classes.set(Class.name, Class)
  }

  // The serialized errors on the current path, as in serializeError: a cycle
  // cannot come out of JSON, but an object built by hand can hold one.
  const path = new Set<unknown>()

  const walk = (current: object, currentMessage: string, depth: number): Error => {
    // Rebuilds something this error holds, when it is a serialized error and
    // neither the depth limit nor a cycle says to stop. Anything else, a real
    // error included, is kept as it is.
    const descend = (next: unknown): unknown => {
      if (
        isInstanceOf(next, Error) ||
        typeof next !== 'object' ||
        next === null ||
        depth >= maxDepth ||
        path.has(next)
      ) {
        return next
      }

      const nextMessage = readString(next, 'message')
      return nextMessage === undefined ? next : walk(next, nextMessage, depth + 1)
    }

    path.add(current)

    const name = readString(current, 'name') ?? 'Error'
    const Class = classes.get(name)

    // An AggregateError's `errors`, rebuilt the way a cause is. Read under that
    // name only: other classes keep other things there.
    const errors =
      name === 'AggregateError' ? arrayItems(read(current, 'errors'))?.map(descend) : undefined

    // Handed to the constructor, so the class sets them the way it would for
    // any other throw; `cause` only when there was one, for the reason
    // ExtendedError gives.
    const constructorOptions: { cause?: unknown; context?: ErrorContext } = {}
    if (has(current, 'cause')) {
      const cause = tryRead(current, 'cause')
      if (cause.ok) constructorOptions.cause = descend(cause.value)
    }
    const context = read(current, 'context')
    if (typeof context === 'object' && context !== null) {
      constructorOptions.context = context as ErrorContext
    }

    const error =
      Class !== undefined
        ? new Class(currentMessage, constructorOptions)
        : errors !== undefined
          ? new AggregateError(errors, currentMessage, constructorOptions)
          : new ExtendedError(currentMessage, constructorOptions)

    if (error.name !== name) restore(error, 'name', name, false)

    const code = readString(current, 'code')
    if (code !== undefined) restore(error, 'code', code, true)

    // A built-in class ignores `context` in its options.
    if (typeof context === 'object' && context !== null) restore(error, 'context', context, true)

    const stack = readString(current, 'stack')
    if (stack === undefined) Reflect.deleteProperty(error, 'stack')
    else restore(error, 'stack', stack, false)

    if (errors !== undefined) {
      // Already in place on an AggregateError; a class of your own by that name
      // gets it the same way, as a field that is not enumerable.
      restore(error, 'errors', errors, false)
      const omitted = read(current, 'errorsOmitted')
      if (typeof omitted === 'number') restore(error, 'errorsOmitted', omitted, false)
    }

    const fixed = errors === undefined ? FIXED_FIELDS : AGGREGATE_FIELDS
    for (const key of keys(current)) {
      if (fixed.has(key)) continue
      const field = tryRead(current, key)
      if (!field.ok) continue
      // serializeError always writes a name for an error it walked, so a field
      // without one is data — `{ message: 'Not found', status: 404 }` — and
      // stays data.
      restore(error, key, hasName(field.value) ? descend(field.value) : field.value, true)
    }

    path.delete(current)
    return error
  }

  return walk(value, message, 0)
}

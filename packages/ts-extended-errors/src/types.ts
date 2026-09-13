/**
 * Structured data attached to an error — the fields you would otherwise
 * interpolate into the message and then have to parse back out.
 *
 * Keep it serializable: {@link SerializedError} is what ends up in a log line,
 * and `serializeError` copies it through a JSON round trip, so a `Date` there
 * becomes a string and a `Map` an empty object.
 */
export type ErrorContext = Readonly<Record<string, unknown>>

/** Second argument of every {@link ExtendedError} constructor. */
export interface ExtendedErrorOptions<Context extends ErrorContext = ErrorContext> {
  /**
   * The error (or value) that caused this one. Forwarded to the native
   * `Error` `cause`, so it is visible to anything that already understands it.
   */
  readonly cause?: unknown
  /** Structured data describing *this* failure, not the one below it. */
  readonly context?: Context
}

/**
 * The plain-object form of an error: what `JSON.stringify` produces for an
 * {@link ExtendedError}, and what {@link serializeError} produces for anything
 * else.
 */
export interface SerializedError {
  readonly name: string
  readonly message: string
  /** Present only when the error carries one. */
  readonly code?: string | undefined
  /** Omitted when `includeStack` is false. */
  readonly stack?: string | undefined
  /** A copy of the error's `context`, taken through a JSON round trip. */
  readonly context?: ErrorContext | undefined
  /** The serialized `cause`, recursively, up to the configured depth. */
  readonly cause?: SerializedError | undefined
  /** An AggregateError's `errors`, each serialized like a `cause`. Present only for one. */
  readonly errors?: readonly SerializedError[] | undefined
  /**
   * How many of an AggregateError's errors are missing from `errors`, cut by
   * `maxAggregatedErrors` here or on an earlier hop. Present only when some are.
   */
  readonly errorsOmitted?: number | undefined
}

/**
 * What {@link serializeError} returns with `includeOwnProperties`: the fixed
 * fields, plus whatever other fields the error carried, down the whole chain.
 */
export interface SerializedErrorWithProperties extends SerializedError {
  readonly cause?: SerializedErrorWithProperties | undefined
  readonly errors?: readonly SerializedErrorWithProperties[] | undefined
  readonly [field: string]: unknown
}

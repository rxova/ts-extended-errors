import { serializeError } from './serialize'
import { isInstanceOf } from './safe'
import type { ErrorContext, ExtendedErrorOptions, SerializedError } from './types'

/**
 * What an extended error's constructor passes to `super`.
 *
 * `cause` is forwarded only when the caller actually passed one.
 * `super(message, { cause: undefined })` still *defines* the property, which
 * makes `'cause' in error` true for an error that has none — and that is
 * exactly the check a chain walker uses to decide where to stop.
 *
 * Internal: shared with the classes {@link defineError} builds on a base that
 * is not an ExtendedError, which is why it is not exported from the package.
 */
export const superOptions = (options: { readonly cause?: unknown }): ErrorOptions | undefined =>
  'cause' in options ? { cause: options.cause } : undefined

/**
 * Starts `error`'s stack at the line that threw rather than inside its
 * constructor.
 *
 * V8 only, hence the guard — JavaScriptCore and SpiderMonkey have no such
 * method. Passing the constructor omits its own frames from the trace, so the
 * top frame is the throw site. Internal, like {@link superOptions}.
 */
export const captureStack = (
  error: Error,
  constructedBy: abstract new (...args: never[]) => unknown,
): void => {
  if (typeof Error.captureStackTrace === 'function') {
    Error.captureStackTrace(error, constructedBy)
  }
}

/**
 * The base class every error here extends.
 *
 * Subclassing `Error` in TypeScript is a pile of small traps — a `name` that
 * still says `Error`, an `instanceof` that returns false, a stack whose top
 * frame is the constructor rather than the throw. Each is individually easy to
 * fix and individually easy to forget, which is the entire reason this class
 * exists: subclass it and the details are already handled.
 *
 * @example
 * ```ts
 * class ConfigError extends ExtendedError<{ file: string }> {}
 *
 * throw new ConfigError('missing "port"', {
 *   context: { file: 'app.config.json' },
 *   cause: parseError,
 * })
 * ```
 */
export class ExtendedError<Context extends ErrorContext = ErrorContext> extends Error {
  /**
   * A stable, machine-readable discriminator shared by every instance of a
   * subclass — the thing to branch on, since `message` is prose and will be
   * reworded.
   *
   * Static, so a subclass declares it once rather than at every throw site.
   * {@link defineError} sets it for you.
   */
  static readonly code: string | undefined = undefined

  /**
   * The constructed class's name. Set from `new.target`, so a subclass reports
   * its own name without restating it.
   */
  override readonly name: string

  /** The static {@link ExtendedError.code} of the constructed class, copied onto the instance so it survives serialization. */
  readonly code: string | undefined

  /** Structured data describing this failure. */
  readonly context: Context | undefined

  constructor(message: string, options: ExtendedErrorOptions<Context> = {}) {
    super(message, superOptions(options))

    // The class that was actually constructed, which for `new ConfigError(…)`
    // is ConfigError even though this code lives on the base.
    const constructedBy = new.target

    // Restores the prototype chain. When this is compiled down to ES5 (or run
    // through a bundler that does), `super()` returns a fresh Error object and
    // `instanceof ConfigError` is false without this line. It costs a property
    // write here and is unfixable at the call site.
    Object.setPrototypeOf(this, constructedBy.prototype)

    this.name = constructedBy.name
    this.code = constructedBy.code
    this.context = options.context

    captureStack(this, constructedBy)
  }

  /**
   * Makes `JSON.stringify(error)` produce something useful. Without it the
   * answer is `{}`: `message` and `stack` are non-enumerable on `Error`, so the
   * default serializer sees nothing at all.
   */
  toJSON(): SerializedError {
    return serializeError(this)
  }
}

/**
 * Narrows an unknown thrown value to {@link ExtendedError}.
 *
 * `instanceof`, so it is false for an instance from a second copy of this
 * package in the same process. That is the honest answer — two copies mean two
 * distinct classes — and {@link serializeError} is the cross-realm-tolerant
 * path when you need one. A proxy that refuses prototype inspection returns
 * `false` rather than throwing from this guard.
 */
export const isExtendedError = (value: unknown): value is ExtendedError =>
  isInstanceOf(value, ExtendedError)

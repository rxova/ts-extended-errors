import { ExtendedError } from './ExtendedError'
import type { ErrorContext, ExtendedErrorOptions } from './types'

/** The class {@link defineError} returns. */
export interface ExtendedErrorConstructor<Context extends ErrorContext = ErrorContext> {
  new (message: string, options?: ExtendedErrorOptions<Context>): ExtendedError<Context>
  readonly prototype: ExtendedError<Context>
  /** Inherited from the base class when this one does not declare its own. */
  readonly code: string | undefined
}

/** Options for {@link defineError}. */
export interface DefineErrorOptions<Context extends ErrorContext = ErrorContext> {
  /**
   * The machine-readable discriminator for this class. Omit it and the class
   * inherits its base's code, which is usually what you want for a leaf that
   * callers handle by `instanceof` rather than by code.
   */
  readonly code?: string
  /**
   * The class to extend. Defaults to {@link ExtendedError}.
   *
   * This is what makes a taxonomy possible: derive `NotFoundError` from
   * `HttpError` and one `catch (e) { if (e instanceof HttpError) }` keeps
   * catching it after you add the fifth subclass.
   */
  readonly base?: ExtendedErrorConstructor<Context>
}

/**
 * Declares an error class in one line.
 *
 * The class it returns is a real class: `instanceof` works, subclassing works,
 * and the stack is captured at the throw site. The only thing it saves you is
 * the boilerplate — which is exactly the boilerplate people skip, which is how
 * a codebase ends up matching on `error.message`.
 *
 * @example
 * ```ts
 * const HttpError = defineError('HttpError', { code: 'HTTP' })
 * const NotFoundError = defineError('NotFoundError', {
 *   base: HttpError,
 *   code: 'HTTP_NOT_FOUND',
 * })
 *
 * const error = new NotFoundError('no such user', { context: { id: 7 } })
 * error instanceof NotFoundError // true
 * error instanceof HttpError     // true
 * error instanceof Error         // true
 * error.name                     // 'NotFoundError'
 * error.code                     // 'HTTP_NOT_FOUND'
 * ```
 */
export function defineError<Context extends ErrorContext = ErrorContext>(
  name: string,
  options: DefineErrorOptions<Context> = {},
): ExtendedErrorConstructor<Context> {
  // Annotated rather than inferred: extending a value typed by a construct
  // signature does not carry the base's statics into the derived class's type,
  // so without this the `code` below has nothing to fall back to.
  const base: ExtendedErrorConstructor<Context> = options.base ?? ExtendedError

  const Defined = class extends base {
    // Falls back to the base's code, so a leaf that callers handle by
    // `instanceof` keeps its family's code instead of shadowing it with
    // `undefined`.
    static override readonly code: string | undefined = options.code ?? base.code
  }

  // A class expression takes its name from the binding it is assigned to, so
  // without this every class defined here would be called `Defined` — and that
  // name is what `new.target.name` copies onto `error.name`.
  Object.defineProperty(Defined, 'name', { value: name, configurable: true })

  return Defined
}

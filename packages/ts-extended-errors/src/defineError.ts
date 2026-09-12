import { ExtendedError, captureStack, superOptions } from './ExtendedError'
import { serializeError } from './serialize'
import type { ErrorContext, ExtendedErrorOptions, SerializedError } from './types'

/**
 * Any error class whose constructor takes `(message, options)` the way the
 * built-in ones do: `RangeError`, `TypeError`, or a class of your own.
 */
export type ErrorClass<Instance extends Error = Error> = new (
  message: string,
  options?: ErrorOptions,
) => Instance

/**
 * What every class {@link defineError} returns adds to its instances, whatever
 * it extends. An {@link ExtendedError} has all of it.
 */
export interface ExtendedErrorMembers<Context extends ErrorContext = ErrorContext> {
  readonly name: string
  readonly code: string | undefined
  readonly context: Context | undefined
  toJSON(): SerializedError
}

/** The class {@link defineError} returns. */
export interface ExtendedErrorConstructor<
  Context extends ErrorContext = ErrorContext,
  Instance extends Error = ExtendedError<Context>,
> {
  new (message: string, options?: ExtendedErrorOptions<Context>): Instance
  readonly prototype: Instance
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
   *
   * A built-in error class works too — see the second {@link defineError}
   * overload.
   */
  readonly base?: ExtendedErrorConstructor<Context>
}

/** True for ExtendedError and its subclasses, whose constructor already does the work. */
const isExtendedClass = (base: ErrorClass): base is typeof ExtendedError =>
  base === ExtendedError ||
  Object.prototype.isPrototypeOf.call(ExtendedError.prototype, base.prototype)

/**
 * A class on `base` that does what ExtendedError's constructor does: its own
 * name, the static code copied onto the instance, context, the cause rule, the
 * prototype fix and a trimmed stack, plus `toJSON`.
 *
 * It cannot extend ExtendedError as well, because a class has one parent, so
 * `instanceof ExtendedError` is false for it. That is the honest answer: it is
 * a RangeError, say, that carries the same fields.
 */
const extendBase = (base: ErrorClass, code: string | undefined) =>
  class extends base {
    static readonly code: string | undefined = code

    override readonly name: string
    readonly code: string | undefined
    readonly context: ErrorContext | undefined

    constructor(message: string, options: ExtendedErrorOptions = {}) {
      super(message, superOptions(options))

      const constructedBy = new.target

      // The same fix as ExtendedError's constructor, for the same reason: a
      // base compiled down to ES5 hands back a plain Error from `super()`.
      Object.setPrototypeOf(this, constructedBy.prototype)

      this.name = constructedBy.name
      this.code = constructedBy.code
      this.context = options.context

      captureStack(this, constructedBy)
    }

    toJSON(): SerializedError {
      return serializeError(this)
    }
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
  options?: DefineErrorOptions<Context>,
): ExtendedErrorConstructor<Context>
/**
 * Declares an error class on a base that is not an {@link ExtendedError}: a
 * built-in class such as `RangeError`, or any error class whose constructor
 * takes `(message, options)`.
 *
 * Its instances get everything an ExtendedError has — name, `code`, `context`,
 * `cause`, a trimmed stack, `toJSON` — but not ExtendedError itself in their
 * prototype chain, so `instanceof ExtendedError` is false for them.
 *
 * To type `context` as well, name both parameters, since TypeScript will not
 * infer one when you give the other:
 * `defineError<{ page: number }, RangeError>('PageError', { base: RangeError })`.
 *
 * @example
 * ```ts
 * const OutOfRangeError = defineError('OutOfRangeError', {
 *   base: RangeError,
 *   code: 'OUT_OF_RANGE',
 * })
 *
 * new OutOfRangeError('page 0') instanceof RangeError // true
 * ```
 */
export function defineError<
  Context extends ErrorContext = ErrorContext,
  Base extends Error = Error,
>(
  name: string,
  options: { readonly code?: string; readonly base: ErrorClass<Base> },
): ExtendedErrorConstructor<Context, Base & ExtendedErrorMembers<Context>>
export function defineError(
  name: string,
  options: { readonly code?: string; readonly base?: ErrorClass } = {},
): ErrorClass {
  const base = options.base ?? ExtendedError

  // Falls back to the base's code, so a leaf that callers handle by
  // `instanceof` keeps its family's code instead of shadowing it with
  // `undefined`. Read defensively: a built-in class has no `code`, and a class
  // of your own may keep anything there.
  const inherited: unknown = (base as { readonly code?: unknown }).code
  const code = options.code ?? (typeof inherited === 'string' ? inherited : undefined)

  const Defined = isExtendedClass(base)
    ? class extends base {
        static override readonly code: string | undefined = code
      }
    : extendBase(base, code)

  // A class expression takes its name from the binding it is assigned to, so
  // without this every class defined here would be called `Defined` — and that
  // name is what `new.target.name` copies onto `error.name`.
  Object.defineProperty(Defined, 'name', { value: name, configurable: true })

  return Defined
}

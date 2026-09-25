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
export interface ExtendedErrorMembers<Context extends object = ErrorContext> {
  readonly name: string
  readonly code: string | undefined
  readonly context: Context | undefined
  toJSON(): SerializedError
}

/**
 * A `code` as a class declares it: a string literal for
 * `defineError('X', { code: 'X' })`, `string` for a code that was a variable,
 * `undefined` for none.
 */
export type ErrorCode = string | undefined

/**
 * `Instance`, with `code` narrowed to `Code` when the class declares one.
 *
 * `string | undefined` is the type of a `code` nobody declared, and of a class
 * written with the `class` syntax, whose static field the instance type cannot
 * see. There the instance is left as it is rather than intersected with the
 * same type again.
 */
type WithCode<Instance, Code extends ErrorCode> = ErrorCode extends Code
  ? Instance
  : Instance & { readonly code: Code }

/**
 * The `code` a class {@link defineError} returns carries: its own when the
 * options declare one, its base's when they do not.
 *
 * `Code` is inferred from the `code` option. What the runtime does is
 * `code ?? base.code`, and this is that expression on types: an explicit
 * `undefined` inherits, and so does the default, `string | undefined`, which
 * is what `Code` is when nothing was declared — or when the call named its
 * type arguments, since TypeScript then infers none of them. The tuple keeps
 * `Code` from distributing.
 */
type DeclaredCode<Code extends ErrorCode, BaseCode extends ErrorCode> = [Code] extends [undefined]
  ? BaseCode
  : ErrorCode extends Code
    ? BaseCode
    : Code

/**
 * The class {@link defineError} returns.
 *
 * `Code` is the literal type of the class's `code`, on the class and on its
 * instances, so `switch (error.code)` can be exhaustive and a `findCause`
 * predicate can narrow on it. It is `string | undefined` for a class defined
 * with explicit type arguments and no `Code` among them, because TypeScript
 * infers all of a call's type arguments or none.
 */
export interface ExtendedErrorConstructor<
  Context extends object = ErrorContext,
  Instance extends Error = ExtendedError<Context>,
  Code extends ErrorCode = ErrorCode,
> {
  new (message: string, options?: ExtendedErrorOptions<Context>): WithCode<Instance, Code>
  readonly prototype: WithCode<Instance, Code>
  /** Inherited from the base class when this one does not declare its own. */
  readonly code: Code
}

/**
 * `Instance`, with `context` narrowed to `Context` when a throw site has to pass
 * one.
 *
 * The condition is the same one the constructor below uses to decide whether
 * `context` is a required argument, so the instance type says exactly what the
 * call site was made to guarantee. Without it every read of a required context
 * went through `?.` and a `??` for a branch that cannot be taken, which is the
 * boilerplate `message` exists to remove.
 *
 * A context type with no required fields keeps `Context | undefined`: there the
 * options argument really is optional, and an instance really can have none.
 */
type WithContext<Instance, Context extends object> =
  Partial<Context> extends Context ? Instance : Instance & { readonly context: Context }

/**
 * The class {@link defineError} returns when given a `message`. A throw site
 * passes only the options, `new InvalidDateError({ context: { value } })`, and
 * the class writes the message from `context`. `context` is required when its
 * type has required fields, and the options are optional when it has none.
 *
 * When it is required, the instance's `context` is typed as present rather than
 * `Context | undefined` — see {@link WithContext}. `code` is typed the way
 * {@link ExtendedErrorConstructor} types it.
 *
 * It also takes `(message, options)`, where a string first argument is the
 * message itself. That keeps it an {@link ErrorClass}: `deserializeError`
 * rebuilds it with the message the payload carried, and it can be the `base`
 * of another class. That overload cannot require a context without ceasing to be
 * an `ErrorClass`, so it defaults one instead — see {@link withMessage}.
 */
export interface MessageErrorConstructor<
  Context extends object = ErrorContext,
  Instance extends Error = ExtendedError<Context>,
  Code extends ErrorCode = ErrorCode,
> {
  new (
    ...options: Partial<Context> extends Context
      ? [options?: ExtendedErrorOptions<Context>]
      : [options: ExtendedErrorOptions<Context> & { readonly context: Context }]
  ): WithCode<WithContext<Instance, Context>, Code>
  new (
    message: string,
    options?: ExtendedErrorOptions<Context>,
  ): WithCode<WithContext<Instance, Context>, Code>
  readonly prototype: WithCode<WithContext<Instance, Context>, Code>
  /** Inherited from the base class when this one does not declare its own. */
  readonly code: Code
}

/** Options for {@link defineError}. */
export interface DefineErrorOptions<
  Context extends object = ErrorContext,
  Code extends ErrorCode = ErrorCode,
  BaseCode extends ErrorCode = ErrorCode,
> {
  /**
   * The machine-readable discriminator for this class. Omit it and the class
   * inherits its base's code, which is usually what you want for a leaf that
   * callers handle by `instanceof` rather than by code.
   *
   * Written as a literal, it is the literal type of `code` on the class and
   * its instances.
   */
  readonly code?: Code
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
  readonly base?: ExtendedErrorConstructor<Context, ExtendedError<Context>, BaseCode>
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
    // Own properties only when present, as on ExtendedError.
    declare readonly code: string | undefined
    declare readonly context: ErrorContext | undefined

    constructor(message: string, options: ExtendedErrorOptions = {}) {
      super(message, superOptions(options))

      const constructedBy = new.target

      // The same fix as ExtendedError's constructor, for the same reason: a
      // base compiled down to ES5 hands back a plain Error from `super()`.
      Object.setPrototypeOf(this, constructedBy.prototype)

      this.name = constructedBy.name
      if (constructedBy.code !== undefined) this.code = constructedBy.code
      if (options.context !== undefined) this.context = options.context

      captureStack(this, constructedBy)
    }

    toJSON(): SerializedError {
      return serializeError(this)
    }
  }

/**
 * A subclass of `Defined` that writes its message from the context.
 *
 * A string first argument is taken as the message instead. That is the
 * `(message, options)` constructor every other class here has, and it is how
 * `deserializeError` rebuilds one: with the message that was sent, rather than
 * one formatted again from context that went through JSON, where a `Date` is
 * now a string.
 */
const withMessage = (Defined: ErrorClass, format: (context: object) => string) =>
  class extends Defined {
    constructor(first?: unknown, second?: ExtendedErrorOptions) {
      if (typeof first === 'string') {
        // The only way to reach a class with a required context without passing
        // one, and `deserializeError` takes it for every rebuild: a payload that
        // carries no `context` would otherwise produce an instance whose type
        // promises a context it does not have, and `error.context.key` would
        // throw rather than read `undefined`.
        //
        // Requiring the argument here instead is not open: this overload is what
        // makes the class an `ErrorClass`, which is what lets `deserializeError`
        // accept it in `classes` and what lets it be another class's `base`.
        //
        // Built as a variable rather than inline: `Defined` is an `ErrorClass`,
        // whose options parameter is the native `ErrorOptions`, and an object
        // literal there is excess-property checked against it.
        const options: ExtendedErrorOptions = { ...second, context: second?.context ?? {} }
        super(first, options)
      } else {
        const options = (first ?? {}) as ExtendedErrorOptions
        super(formatMessage(format, options.context ?? {}, new.target.name), options)
      }
    }
  }

/**
 * Calls `format`, and returns `fallback` when it throws.
 *
 * The formatter runs on data nobody has checked, often inside a `catch` that is
 * already handling a failure. If its exception escaped, the caller would get a
 * `TypeError` from `JSON.stringify(10n)` in place of the error it meant to
 * throw, and the context with it would be lost.
 */
const formatMessage = (
  format: (context: object) => string,
  context: object,
  fallback: string,
): string => {
  try {
    return format(context)
  } catch {
    return fallback
  }
}

/**
 * Declares an error class that writes its own message, so a throw site passes
 * only the context.
 *
 * The type of `context` is taken from the parameter of `message`, or from the
 * first type parameter when you give one. When `message` throws, the error is
 * still created, with the class name as its message, rather than the caller
 * getting the formatter's exception in its place.
 *
 * @example
 * ```ts
 * const InvalidDateError = defineError('InvalidDateError', {
 *   code: 'INVALID_DATE',
 *   message: (context: { value: string }) => `"${context.value}" is not a valid date`,
 * })
 *
 * const error = new InvalidDateError({ context: { value: '2026-02-30' } })
 * error.message // '"2026-02-30" is not a valid date'
 * ```
 */
export function defineError<
  Context extends object = ErrorContext,
  Code extends ErrorCode = ErrorCode,
  BaseCode extends ErrorCode = ErrorCode,
>(
  name: string,
  options: DefineErrorOptions<Context, Code, BaseCode> & {
    readonly message: (context: Context) => string
  },
): MessageErrorConstructor<Context, ExtendedError<Context>, DeclaredCode<Code, BaseCode>>
/**
 * Declares an error class that writes its own message, on a base that is not
 * an {@link ExtendedError}, such as `RangeError`.
 *
 * @example
 * ```ts
 * const PageError = defineError('PageError', {
 *   base: RangeError,
 *   message: (context: { page: number }) => `page ${String(context.page)} does not exist`,
 * })
 *
 * new PageError({ context: { page: 0 } }) instanceof RangeError // true
 * ```
 */
export function defineError<
  Context extends object = ErrorContext,
  Base extends Error = Error,
  Code extends ErrorCode = ErrorCode,
>(
  name: string,
  options: {
    readonly code?: Code
    readonly base: ErrorClass<Base>
    readonly message: (context: Context) => string
  },
): MessageErrorConstructor<
  Context,
  Base & ExtendedErrorMembers<Context>,
  DeclaredCode<Code, ErrorCode>
>
/**
 * Declares a subclass of a class that writes its own message. Without a
 * `message` of its own, it writes the message the way its base does.
 *
 * @example
 * ```ts
 * const PastDateError = defineError('PastDateError', { base: InvalidDateError })
 *
 * new PastDateError({ context: { value: '1999-01-01' } }) instanceof InvalidDateError // true
 * ```
 */
export function defineError<
  Context extends object = ErrorContext,
  Instance extends Error = ExtendedError<Context>,
  Code extends ErrorCode = ErrorCode,
  BaseCode extends ErrorCode = ErrorCode,
>(
  name: string,
  options: {
    readonly code?: Code
    readonly base: MessageErrorConstructor<Context, Instance, BaseCode>
  },
): MessageErrorConstructor<Context, Instance, DeclaredCode<Code, BaseCode>>
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
 * error.code                     // 'HTTP_NOT_FOUND', typed as that literal
 * ```
 */
export function defineError<
  Context extends object = ErrorContext,
  Code extends ErrorCode = ErrorCode,
  BaseCode extends ErrorCode = ErrorCode,
>(
  name: string,
  options?: DefineErrorOptions<Context, Code, BaseCode>,
): ExtendedErrorConstructor<Context, ExtendedError<Context>, DeclaredCode<Code, BaseCode>>
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
  Context extends object = ErrorContext,
  Base extends Error = Error,
  Code extends ErrorCode = ErrorCode,
>(
  name: string,
  options: { readonly code?: Code; readonly base: ErrorClass<Base> },
): ExtendedErrorConstructor<
  Context,
  Base & ExtendedErrorMembers<Context>,
  DeclaredCode<Code, ErrorCode>
>
export function defineError(
  name: string,
  options: {
    readonly code?: string
    readonly base?: ErrorClass
    readonly message?: (context: object) => string
  } = {},
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

  if (options.message === undefined) return Defined

  const WithMessage = withMessage(Defined, options.message)
  Object.defineProperty(WithMessage, 'name', { value: name, configurable: true })

  return WithMessage
}

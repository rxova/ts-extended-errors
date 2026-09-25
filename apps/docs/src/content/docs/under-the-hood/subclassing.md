---
title: Subclassing Error
description: The four things that break when you extend Error in TypeScript, and the four lines in ExtendedError's constructor that fix each one.
---

`ExtendedError`'s constructor is about fifteen lines. Each one exists for a specific, reproducible
failure.

```ts
constructor(message: string, options: ExtendedErrorOptions<Context> = {}) {
  super(message, superOptions(options))

  const constructedBy = new.target

  Object.setPrototypeOf(this, constructedBy.prototype)

  this.name = constructedBy.name
  this.code = constructedBy.code
  this.context = options.context

  captureStack(this, constructedBy)
}
```

## `new.target`, not `this.constructor`

`new.target` is the class the `new` expression actually named. For `new ConfigError(…)` it is
`ConfigError`, even though this code lives on the base class — which is what lets a subclass get its
own name and its own `code` without restating either.

## `Object.setPrototypeOf`

Compile a class down to ES5 — directly, or through a bundler that targets an older baseline — and
`super()` returns a _fresh_ `Error` object rather than initialising `this`. The prototype chain is
lost with it, so `instanceof ConfigError` is false.

Restoring the prototype costs one property write in the constructor and is unfixable at the call
site, which is the trade that decides it. It is the single most common surprise when subclassing
`Error` in TypeScript, and the one most likely to be discovered in production, since it only appears
under a build configuration the tests may not use.

Be precise about which build that is. The package ships native classes, so the line matters when a
bundler transpiles the library to ES5 _along with_ your code: `ExtendedError` is then a function
that calls `Error` the ES5 way, gets a fresh object back, and this line puts the subclass prototype
on it. A project compiled to ES5 against the shipped build is a different case, and no line here can
help it: `class ConfigError extends ExtendedError` compiled by `tsc` to ES5 throws
`Class constructor ExtendedError cannot be invoked without 'new'`, as extending any native class
does. The fix there is to let the bundler transpile `node_modules` too. Babel and SWC keep
`new.target` through `Reflect.construct`, so under them the line finds the prototype already in
place and writes it again.

## `name`

`Error`'s `name` comes from the prototype and stays `'Error'` for a subclass that does not set it.
Every log line, every `toString()`, every serialized payload then says `Error` for a class you named
carefully. Setting it from `new.target.name` means a subclass reports itself, and a class declared
with `defineError` reports the name passed to the factory — the factory redefines the class's own
`name` for exactly that reason, since a class expression would otherwise be called `Defined`.

## `code`

Declared `static` so it is written once per class rather than at every throw site, and copied onto
the instance so it survives serialization: a plain object produced from the error has no class to
read a static off.

A class that declares no `code` of its own gets its base's, which is what you want for a leaf that
callers distinguish by `instanceof` rather than by code.

## `cause`, only when there was one

```ts
const superOptions = (options) => ('cause' in options ? { cause: options.cause } : undefined)
```

`super(message, { cause: undefined })` still _defines_ the property. `'cause' in error` would then
be true for an error that has none — and that is precisely the check a chain walker uses to decide
where to stop. So the options object is forwarded only when the caller actually passed a cause.

## `Error.captureStackTrace`

Without it, the top frame of the stack is the constructor, and the line that actually threw is one
frame down. Passing the constructor as the second argument omits its own frames, so the trace starts
at the throw site.

It is V8-only — JavaScriptCore and SpiderMonkey have no such method — hence the `typeof` guard. On
those engines the stack is whatever the engine produced, which is still correct, just one frame
noisier.

## `toJSON`

`message` and `stack` are non-enumerable on `Error`, so `JSON.stringify(new Error('x'))` is `{}`.
Defining `toJSON` as `serializeError(this)` is what makes an error usable with any logger that
stringifies its input, without that logger knowing anything about this package.

## Classes on a base that is not an `ExtendedError`

`defineError(name, { base: RangeError })` cannot extend `ExtendedError` as well — a class has one
parent. So the factory builds an equivalent constructor on top of the given base: the same
`new.target` reads, the same prototype restore, the same stack capture, the same `toJSON`.

The result carries every member an `ExtendedError` has, but `instanceof ExtendedError` and
`isExtendedError` are false for it. That is the accurate answer rather than a convenient one: it is
a `RangeError` that happens to carry the same fields.

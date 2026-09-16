---
'@rxova/ts-extended-errors': minor
---

Type `context` as present on the instances of a class defined with `message`, when the throw site has
to pass one. Fixes #17.

`message` makes `context` a required constructor argument as soon as its type has a required field,
but the instance type stayed `Context | undefined` — so every read went through a `?.` and a `??`
for a branch that cannot be taken, and the workaround was a hand-written class holding the value as
its own field, which is the boilerplate `message` exists to remove.

```ts
const CorruptRecordError = defineError('CorruptRecordError', {
  message: ({ key }: { key: string }) => `unreadable record: ${key}`,
})

const found = findCauseOf(error, CorruptRecordError)
found?.context.key // string — was `'context' is possibly 'undefined'`
```

The narrowing uses the same condition the constructor already uses to decide whether `context` is
required, so a class whose context has no required fields is unchanged: there the options argument
really is optional and an instance really can have none.

The `(message, options)` constructor is the one path that could otherwise build an instance without
a context, and `deserializeError` rebuilds through it. It cannot require the argument without the
class ceasing to be an `ErrorClass` — which is what lets it be passed in `classes` and be another
class's `base` — so it now defaults `context` to `{}`. A payload carrying no `context` therefore
rebuilds as `context: {}` rather than `undefined`, and `error.context.key` reads `undefined` instead
of throwing.

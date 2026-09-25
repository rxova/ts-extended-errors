---
'ts-extended-errors': minor
---

Type `code` as the literal a class declares. `defineError('NotFoundError', { code: 'HTTP_NOT_FOUND' })`
now types `code` as `'HTTP_NOT_FOUND'` on the class and on its instances, and a class defined without
one is typed with its base's, so a `switch` over a taxonomy's codes can be exhaustive and a
`findCause` predicate can narrow on one. `ExtendedErrorConstructor`, `MessageErrorConstructor` and
`DefineErrorOptions` gain a `Code` type parameter after their existing ones, and `ErrorCode`, its
constraint, is exported.

Two consequences. Naming `Context` as a type argument leaves `code` at `string | undefined`, because
TypeScript infers all of a call's type arguments or none; name `Code` as well,
`defineError<Context, 'X'>(…)`, to keep the literal. And a class-syntax subclass of a `defineError`
class can no longer declare a different static `code`, since its instance type already carries the
base's literal; define the leaf with `defineError` and extend that.

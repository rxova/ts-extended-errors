---
'ts-extended-errors': minor
---

Accept any object type as a `context` type, an `interface` included. The `Context` type parameters of
`ExtendedError`, `defineError` and the exported constructor types were constrained to
`Readonly<Record<string, unknown>>`, which an `interface` fails for lack of an index signature, so
`defineError<UserContext>(…)` was a type error whenever `UserContext` was declared with `interface`.
The constraint is now `object`; `ErrorContext` stays the default.

---
'ts-extended-errors': major
---

Version 1.0.0. The API that shipped through the 0.x releases is now stable: `ExtendedError`,
`defineError`, the five cause-chain helpers, `serializeError`, `deserializeError`, `toError`,
`isErrorLike`, `describeValue` and the exported types. From here, a breaking change to any of them,
to the serialized shape, or to the defaults of `toJSON` and `serializeError` means a new major.

What 1.0 settles on purpose: `JSON.stringify(error)` includes `stack` by default and is meant for
logs, with `includeStack: false` for anything client-facing; a thrown value that is not an error
serializes under `name: typeof value`; and cause chains are linear, following `cause` and never an
`AggregateError`'s `errors`.

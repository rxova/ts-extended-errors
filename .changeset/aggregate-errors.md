---
'@rxova/ts-extended-errors': minor
---

`serializeError` writes an `AggregateError`'s `errors`, each serialized like a `cause`, and
`deserializeError` rebuilds them as an `AggregateError`. The new `maxAggregatedErrors` option
(default 10) caps how many are kept across the whole output, and `errorsOmitted` counts the rest.

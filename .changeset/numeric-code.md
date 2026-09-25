---
'ts-extended-errors': minor
---

Keep a numeric `code` through `serializeError` and `deserializeError`. A `DOMException` and many
driver errors carry a number there, and it was dropped, even under `includeOwnProperties`, because
`code` is a fixed field read only as a string. `SerializedError.code` is now `string | number`; a
code that is neither a string nor a finite number is still left out. An `ExtendedError`'s own `code`
stays a string.

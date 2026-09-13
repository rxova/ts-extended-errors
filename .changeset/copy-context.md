---
'@rxova/ts-extended-errors': patch
---

`serializeError` copies `context` field by field through a JSON round trip instead of returning the
error's own object. A later change to the error's context no longer changes a serialized copy, a
redactor editing the output no longer edits the error, and a `BigInt` in `context` or in an own
field is written as `'10n'` instead of making `JSON.stringify` throw.

---
"ts-extended-errors": minor
---

Add a `fallback` option to `deserializeError`: called with the serialized `name` and `code` of an error whose name matches no class, it returns the class to rebuild it as, or `undefined` for the default `ExtendedError`. The rebuilt error keeps the serialized `name` either way.

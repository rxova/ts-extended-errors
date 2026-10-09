---
"ts-extended-errors": minor
---

Add a `meta` option to `defineError`: fixed data about a class, such as the HTTP status a handler answers with. It is read as `Class.meta` or `error.meta`, merged over the base's `meta` key by key, frozen, and typed; a key the base declares keeps the base's type. It is not serialized, since a rebuilt error reads it from its class.

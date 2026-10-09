---
"ts-extended-errors": patch
---

A class defined with `message` now requires `context` through its `(message, options)` constructor as well, when the context type has required fields, so `new RateLimitError('slow down')` no longer compiles with an instance whose `context.retryAfter` is typed `number` but is `undefined`. Such a class is therefore no longer assignable to `ErrorClass`; `base` and `deserializeError`'s `classes` still accept it.

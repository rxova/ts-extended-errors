---
"ts-extended-errors": patch
---

A class whose base declares a literal `code` and which declares its own, such as a `message` class on `HttpError` with `code: 'HTTP_TOO_MANY'`, no longer has an instance type of `never`. The base's `code` is replaced by the class's own instead of intersected with it.

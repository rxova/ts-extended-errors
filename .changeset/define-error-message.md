---
'@rxova/ts-extended-errors': minor
---

`defineError` takes a `message` option, `(context) => string`, that writes the message from the
context: `new InvalidDateError({ context: { value } })`. The type of `context` comes from its
parameter or from the type parameter, and is required when it has required fields. A class defined
on one without its own `message` writes the message the same way. When `message` throws, the error
is still created, with the class name as its message. A string first argument still sets the
message, which is how `deserializeError` rebuilds these classes. Classes defined without `message`
are unchanged.

---
"ts-extended-errors": minor
---

A class defined on an `ExtendedError` base can declare a context of its own, through its first type argument or the parameter of `message`, as long as it includes the base's. `defineError<{ slug: string }>('LinkError', { base: HttpError })` is now typed as an `ExtendedError<{ slug: string }>` subclass, and with its own `code` it no longer fails to compile.

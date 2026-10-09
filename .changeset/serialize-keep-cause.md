---
"ts-extended-errors": minor
---

Add a `keepCause` option to `serializeError`: a predicate asked about each `cause` in turn, which cuts the chain at the first cause it returns `false` for. `keepCause: isExtendedError` keeps your own errors and leaves out a foreign error below them, such as a database driver's, and everything under it.
